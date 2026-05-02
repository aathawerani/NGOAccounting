from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.models import Investment, InvestmentProfit, Trust

router = APIRouter(prefix="/api/investments", tags=["investments"])

CERT_TYPES = ["SSC", "DSC", "BEH", "BSC"]


class PurchaseBody(BaseModel):
    trust_id: int
    certificate_type: str           # SSC | DSC | BEH | BSC
    certificate_number: str
    folio_number: Optional[str] = None
    amount: float
    purchase_date: date
    certificate_date: Optional[date] = None
    maturity_date: Optional[date] = None
    notes: Optional[str] = None


class ProfitBody(BaseModel):
    date: date
    profit_amount: float
    withholding_tax: float = 0.0


class SellBody(BaseModel):
    sale_date: date


def _serialize(inv: Investment) -> dict:
    return {
        "id": inv.id,
        "trust_id": inv.trust_id,
        "certificate_type": inv.certificate_type,
        "certificate_number": inv.certificate_number,
        "folio_number": inv.folio_number,
        "amount": inv.amount,
        "status": inv.status,
        "purchase_date": inv.purchase_date.isoformat() if inv.purchase_date else None,
        "certificate_date": inv.certificate_date.isoformat() if inv.certificate_date else None,
        "maturity_date": inv.maturity_date.isoformat() if inv.maturity_date else None,
        "sale_date": inv.sale_date.isoformat() if inv.sale_date else None,
        "notes": inv.notes,
        "profits": [_serialize_profit(p) for p in inv.profits],
    }


def _serialize_profit(p: InvestmentProfit) -> dict:
    return {
        "id": p.id,
        "investment_id": p.investment_id,
        "date": p.date.isoformat() if p.date else None,
        "profit_amount": p.profit_amount,
        "withholding_tax": p.withholding_tax,
        "net_profit": p.net_profit,
    }


@router.get("")
def list_investments(
    trust_id: Optional[int] = None,
    cert_type: Optional[str] = None,
    include_matured: bool = False,
    db: Session = Depends(get_db),
):
    q = db.query(Investment)
    if trust_id is not None:
        q = q.filter(Investment.trust_id == trust_id)
    if cert_type:
        q = q.filter(Investment.certificate_type == cert_type)
    if not include_matured:
        q = q.filter(Investment.status == "ACTIVE")
    return [_serialize(inv) for inv in q.order_by(Investment.purchase_date.desc(), Investment.id.desc()).all()]


@router.post("", status_code=201)
def purchase(body: PurchaseBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")
    if body.certificate_type not in CERT_TYPES:
        raise HTTPException(status_code=400, detail=f"cert_type must be one of {CERT_TYPES}")

    inv = Investment(
        trust_id=body.trust_id,
        certificate_type=body.certificate_type,
        certificate_number=body.certificate_number,
        folio_number=body.folio_number,
        amount=body.amount,
        status="ACTIVE",
        purchase_date=body.purchase_date,
        certificate_date=body.certificate_date,
        maturity_date=body.maturity_date,
        notes=body.notes,
    )
    db.add(inv)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.post("/{investment_id}/profit", status_code=201)
def record_profit(investment_id: int, body: ProfitBody, db: Session = Depends(get_db)):
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")

    net = body.profit_amount - body.withholding_tax
    profit = InvestmentProfit(
        investment_id=investment_id,
        trust_id=inv.trust_id,
        date=body.date,
        profit_amount=body.profit_amount,
        withholding_tax=body.withholding_tax,
        net_profit=net,
    )
    db.add(profit)
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.put("/{investment_id}/sell")
def sell(investment_id: int, body: SellBody, db: Session = Depends(get_db)):
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    inv.status = "MATURED"
    inv.sale_date = body.sale_date
    db.commit()
    db.refresh(inv)
    return _serialize(inv)


@router.delete("/{investment_id}", status_code=204)
def delete_investment(investment_id: int, db: Session = Depends(get_db)):
    inv = db.query(Investment).filter(Investment.id == investment_id).first()
    if not inv:
        raise HTTPException(status_code=404, detail="Investment not found")
    db.delete(inv)
    db.commit()
