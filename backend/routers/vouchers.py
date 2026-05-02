from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.models import Trust, Voucher

router = APIRouter(prefix="/api/vouchers", tags=["vouchers"])


class VoucherBody(BaseModel):
    trust_id: int
    date: date
    voucher_number: Optional[str] = None
    account_name: Optional[str] = None
    being: Optional[str] = None
    amount: float = 0.0


def _next_voucher_no(trust_id: int, db: Session) -> str:
    last = (
        db.query(Voucher)
        .filter(Voucher.trust_id == trust_id)
        .order_by(Voucher.id.desc())
        .first()
    )
    if not last or not last.voucher_number:
        return "V-001"
    try:
        num = int(last.voucher_number.replace("V-", ""))
        return f"V-{(num % 9999) + 1:03d}"
    except ValueError:
        return "V-001"


def _serialize(v: Voucher) -> dict:
    return {
        "id": v.id,
        "trust_id": v.trust_id,
        "date": v.date.isoformat() if v.date else None,
        "voucher_number": v.voucher_number,
        "account_name": v.account_name,
        "being": v.being,
        "amount": v.amount,
    }


@router.get("")
def list_vouchers(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Voucher)
    if trust_id is not None:
        q = q.filter(Voucher.trust_id == trust_id)
    return [_serialize(v) for v in q.order_by(Voucher.date.desc(), Voucher.id.desc()).all()]


@router.get("/next-number")
def next_number(trust_id: int, db: Session = Depends(get_db)):
    return {"voucher_number": _next_voucher_no(trust_id, db)}


@router.post("", status_code=201)
def create_voucher(body: VoucherBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    v = Voucher(
        trust_id=body.trust_id,
        date=body.date,
        voucher_number=body.voucher_number or _next_voucher_no(body.trust_id, db),
        account_name=body.account_name,
        being=body.being,
        amount=body.amount,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _serialize(v)


@router.delete("/{voucher_id}", status_code=204)
def delete_voucher(voucher_id: int, db: Session = Depends(get_db)):
    v = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher not found")
    db.delete(v)
    db.commit()
