import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, LedgerEntry, Trust

router = APIRouter(prefix="/api/accounts", tags=["accounts"])


# ── Schemas ───────────────────────────────────────────────────────────────────

class JournalEntryBody(BaseModel):
    trust_id: int
    date: date
    receipt_no: Optional[str] = None
    party_name: Optional[str] = None
    debit_account_code: str     # account that gets debited
    credit_account_code: str    # account that gets credited
    particulars: Optional[str] = None
    amount: float


# ── Helpers ───────────────────────────────────────────────────────────────────

def _serialize_entry(e: LedgerEntry) -> dict:
    return {
        "id": e.id,
        "trust_id": e.trust_id,
        "account_code": e.account_code,
        "date": e.date.isoformat() if e.date else None,
        "receipt_no": e.receipt_no,
        "party_name": e.party_name,
        "contra_account_code": e.contra_account_code,
        "particulars": e.particulars,
        "debit": e.debit,
        "credit": e.credit,
        "row_order": e.row_order,
        "account_key": e.account_key,
    }


def _serialize_account(a: AccountType) -> dict:
    return {
        "id": a.id,
        "trust_id": a.trust_id,
        "account_code": a.account_code,
        "account_name": a.account_name,
        "account_type": a.account_type,
        "is_certificate": a.is_certificate,
    }


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("/types")
def list_account_types(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(AccountType)
    if trust_id is not None:
        q = q.filter(AccountType.trust_id == trust_id)
    return [_serialize_account(a) for a in q.order_by(AccountType.account_name).all()]


@router.get("/ledger")
def get_ledger(
    trust_id: int,
    account_code: str,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    """Return all ledger entries for one account, with running balance."""
    acct = db.query(AccountType).filter(
        AccountType.trust_id == trust_id,
        AccountType.account_code == account_code,
    ).first()
    if not acct:
        raise HTTPException(status_code=404, detail="Account not found")

    q = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.account_code == account_code,
    )
    if date_from:
        q = q.filter(LedgerEntry.date >= date_from)
    if date_to:
        q = q.filter(LedgerEntry.date <= date_to)

    entries = q.order_by(LedgerEntry.row_order, LedgerEntry.date, LedgerEntry.id).all()

    running = 0.0
    result = []
    for e in entries:
        running += e.debit - e.credit
        row = _serialize_entry(e)
        row["balance"] = round(running, 2)
        result.append(row)

    return {"account": _serialize_account(acct), "entries": result, "balance": round(running, 2)}


@router.post("/journal", status_code=201)
def create_journal_entry(body: JournalEntryBody, db: Session = Depends(get_db)):
    """Create a dual-entry: debit_account DR, credit_account CR."""
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    for code in (body.debit_account_code, body.credit_account_code):
        if not db.query(AccountType).filter(
            AccountType.trust_id == body.trust_id,
            AccountType.account_code == code,
        ).first():
            raise HTTPException(status_code=404, detail=f"Account '{code}' not found")

    key = str(uuid.uuid4())[:8]

    debit_row = LedgerEntry(
        trust_id=body.trust_id,
        account_code=body.debit_account_code,
        date=body.date,
        receipt_no=body.receipt_no,
        party_name=body.party_name,
        contra_account_code=body.credit_account_code,
        particulars=body.particulars,
        debit=body.amount,
        credit=0.0,
        row_order=2,
        account_key=key,
    )
    credit_row = LedgerEntry(
        trust_id=body.trust_id,
        account_code=body.credit_account_code,
        date=body.date,
        receipt_no=body.receipt_no,
        party_name=body.party_name,
        contra_account_code=body.debit_account_code,
        particulars=body.particulars,
        debit=0.0,
        credit=body.amount,
        row_order=2,
        account_key=key,
    )
    db.add_all([debit_row, credit_row])
    db.commit()
    db.refresh(debit_row)
    db.refresh(credit_row)
    return [_serialize_entry(debit_row), _serialize_entry(credit_row)]


@router.delete("/journal/{account_key}")
def delete_journal_entry(account_key: str, trust_id: int, db: Session = Depends(get_db)):
    """Delete both legs of a dual entry by their shared account_key."""
    rows = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.account_key == account_key,
    ).all()
    if not rows:
        raise HTTPException(status_code=404, detail="Entry not found")
    for r in rows:
        db.delete(r)
    db.commit()
