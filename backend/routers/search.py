"""Global search across ledger entries for the current trust."""

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.models import LedgerEntry

router = APIRouter(prefix="/api/search", tags=["search"])


@router.get("")
def global_search(trust_id: int, q: str, limit: int = 50, db: Session = Depends(get_db)):
    """Search ledger entries by particulars, party_name, voucher / receipt no, or amount."""
    q = q.strip()
    if not q:
        return {"results": []}

    # Try to detect if the query is a numeric amount
    amount_val = None
    try:
        amount_val = float(q.replace(",", ""))
    except ValueError:
        pass

    filters = [
        LedgerEntry.particulars.ilike(f"%{q}%"),
        LedgerEntry.party_name.ilike(f"%{q}%"),
        LedgerEntry.receipt_no.ilike(f"%{q}%"),
        LedgerEntry.account_key.ilike(f"%{q}%"),
        LedgerEntry.account_code.ilike(f"%{q}%"),
        LedgerEntry.contra_account_code.ilike(f"%{q}%"),
    ]
    if amount_val is not None:
        from sqlalchemy import func
        filters += [
            LedgerEntry.debit == amount_val,
            LedgerEntry.credit == amount_val,
        ]

    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.is_deleted == False,
            or_(*filters),
        )
        .order_by(LedgerEntry.date.desc(), LedgerEntry.id.desc())
        .limit(limit)
        .all()
    )

    return {
        "results": [
            {
                "id": e.id,
                "date": e.date.isoformat() if e.date else None,
                "account_code": e.account_code,
                "contra_account_code": e.contra_account_code,
                "particulars": e.particulars,
                "party_name": e.party_name,
                "receipt_no": e.receipt_no,
                "debit": e.debit,
                "credit": e.credit,
                "account_key": e.account_key,
            }
            for e in entries
        ],
        "count": len(entries),
        "query": q,
    }
