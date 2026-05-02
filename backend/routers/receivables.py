from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.models import Receivable, Trust

router = APIRouter(prefix="/api/receivables", tags=["receivables"])


class ReceivableBody(BaseModel):
    trust_id: int
    date: date
    receipt_no: Optional[str] = None
    party_name: Optional[str] = None
    particulars: Optional[str] = None
    amount: float = 0.0


def _serialize(r: Receivable) -> dict:
    return {
        "id": r.id,
        "trust_id": r.trust_id,
        "date": r.date.isoformat() if r.date else None,
        "receipt_no": r.receipt_no,
        "party_name": r.party_name,
        "particulars": r.particulars,
        "amount": r.amount,
        "status": r.status,
    }


@router.get("")
def list_receivables(
    trust_id: Optional[int] = None,
    status: Optional[str] = None,
    db: Session = Depends(get_db),
):
    q = db.query(Receivable)
    if trust_id is not None:
        q = q.filter(Receivable.trust_id == trust_id)
    if status:
        q = q.filter(Receivable.status == status)
    return [_serialize(r) for r in q.order_by(Receivable.date.desc(), Receivable.id.desc()).all()]


@router.post("", status_code=201)
def create_receivable(body: ReceivableBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    r = Receivable(
        trust_id=body.trust_id,
        date=body.date,
        receipt_no=body.receipt_no,
        party_name=body.party_name,
        particulars=body.particulars,
        amount=body.amount,
        status="Pending",
    )
    db.add(r)
    db.commit()
    db.refresh(r)
    return _serialize(r)


@router.put("/{receivable_id}/received")
def mark_received(receivable_id: int, db: Session = Depends(get_db)):
    r = db.query(Receivable).filter(Receivable.id == receivable_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receivable not found")
    r.status = "Received"
    db.commit()
    return _serialize(r)


@router.delete("/{receivable_id}", status_code=204)
def delete_receivable(receivable_id: int, db: Session = Depends(get_db)):
    r = db.query(Receivable).filter(Receivable.id == receivable_id).first()
    if not r:
        raise HTTPException(status_code=404, detail="Receivable not found")
    db.delete(r)
    db.commit()
