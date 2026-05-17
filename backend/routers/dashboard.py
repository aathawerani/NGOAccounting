from typing import Optional

from fastapi import APIRouter, Depends
from sqlalchemy import or_
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, Investment, LedgerEntry, Receivable
from routers.backup import _load_meta

router = APIRouter(prefix="/api/dashboard", tags=["dashboard"])


@router.get("/summary")
def summary(trust_id: int, db: Session = Depends(get_db)):
    # Cash / bank account balances
    cash_accts = db.query(AccountType).filter(
        AccountType.trust_id == trust_id,
        AccountType.account_type == "ASSET",
        or_(
            AccountType.account_code.in_(["CASH", "BOX"]),
            AccountType.account_code.like("BANK%"),
        ),
    ).order_by(AccountType.account_code).all()

    cash_accounts = []
    cash_total = 0.0
    for acct in cash_accts:
        entries = db.query(LedgerEntry).filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.account_code == acct.account_code,
            LedgerEntry.is_deleted == False,
        ).all()
        balance = sum(e.debit - e.credit for e in entries)
        cash_accounts.append({
            "code": acct.account_code,
            "name": acct.account_name,
            "balance": balance,
        })
        cash_total += balance

    # Pending receivables
    pending = db.query(Receivable).filter(
        Receivable.trust_id == trust_id,
        Receivable.status == "Pending",
    ).all()

    # Active investment total
    investments = db.query(Investment).filter(
        Investment.trust_id == trust_id,
        Investment.status == "ACTIVE",
    ).all()
    inv_total = sum(i.amount or 0.0 for i in investments)

    # Recent 10 DR transactions
    recent = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.is_deleted == False,
            LedgerEntry.debit > 0,
        )
        .order_by(LedgerEntry.date.desc(), LedgerEntry.id.desc())
        .limit(10)
        .all()
    )

    return {
        "cash_total": cash_total,
        "cash_accounts": cash_accounts,
        "pending_receivables_count": len(pending),
        "pending_receivables_amount": sum(r.amount or 0.0 for r in pending),
        "investment_total": inv_total,
        "recent_transactions": [
            {
                "date": e.date.isoformat() if e.date else None,
                "account_code": e.account_code,
                "contra_account_code": e.contra_account_code,
                "particulars": e.particulars,
                "amount": e.debit,
            }
            for e in recent
        ],
        "last_backup": _load_meta().get("timestamp"),
    }
