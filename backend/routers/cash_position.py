from typing import Optional
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, LedgerEntry, RentReceipt, MajlisBill, Trust

router = APIRouter(prefix="/api/cash-position", tags=["cash-position"])

CASH_LIKE = {"CASH", "BOX"}


def _is_cash_account(code: str) -> bool:
    return code in CASH_LIKE or code.upper().startswith("BANK")


def _account_balance(trust_id: int, account_code: str, db: Session) -> float:
    rows = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.account_code == account_code,
        LedgerEntry.is_deleted == False,
    ).all()
    return sum((r.debit or 0.0) - (r.credit or 0.0) for r in rows)


def _cash_position_for_trust(trust_id: int, db: Session) -> dict:
    # 1. Physical cash — ASSET cash/bank balances
    cash_types = db.query(AccountType).filter(
        AccountType.trust_id == trust_id,
        AccountType.account_type == "ASSET",
    ).all()
    cash_accounts = []
    for a in cash_types:
        if _is_cash_account(a.account_code):
            bal = _account_balance(trust_id, a.account_code, db)
            cash_accounts.append({"code": a.account_code, "name": a.account_name, "balance": round(bal, 2)})
    physical_cash = sum(a["balance"] for a in cash_accounts)

    # 2. Receivables — shortfall from SHORT receipts (money owed to trust)
    rent_short = db.query(RentReceipt).filter(
        RentReceipt.trust_id == trust_id,
        RentReceipt.cash_status == "SHORT",
    ).all()
    rent_short_amount = sum(max(0.0, (r.total_amount or 0) - (r.cash_received or 0)) for r in rent_short)

    majlis_short = db.query(MajlisBill).filter(
        MajlisBill.trust_id == trust_id,
        MajlisBill.cash_status == "SHORT",
    ).all()
    majlis_short_amount = sum(max(0.0, (b.total_amount or 0) - (b.cash_received or 0)) for b in majlis_short)

    total_receivables = round(rent_short_amount + majlis_short_amount, 2)

    # 3. On-account advances — cash received for ADVANCE receipts (service not yet rendered)
    rent_advance = db.query(RentReceipt).filter(
        RentReceipt.trust_id == trust_id,
        RentReceipt.cash_status == "ADVANCE",
    ).all()
    rent_advance_amount = sum((r.cash_received or 0) for r in rent_advance)

    majlis_advance = db.query(MajlisBill).filter(
        MajlisBill.trust_id == trust_id,
        MajlisBill.cash_status == "ADVANCE",
    ).all()
    majlis_advance_amount = sum((b.cash_received or 0) for b in majlis_advance)

    on_account = round(rent_advance_amount + majlis_advance_amount, 2)

    # 4. Book income — net INCOME account credits (all-time)
    income_types = db.query(AccountType).filter(
        AccountType.trust_id == trust_id,
        AccountType.account_type == "INCOME",
    ).all()
    book_income = 0.0
    for a in income_types:
        rows = db.query(LedgerEntry).filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.account_code == a.account_code,
            LedgerEntry.is_deleted == False,
        ).all()
        book_income += sum((r.credit or 0.0) - (r.debit or 0.0) for r in rows)

    return {
        "physical_cash": round(physical_cash, 2),
        "total_receivables": total_receivables,
        "on_account": round(on_account, 2),
        "book_income": round(book_income, 2),
        "cash_accounts": cash_accounts,
        "receivables_breakdown": {
            "rent_short_count": len(rent_short),
            "rent_short_amount": round(rent_short_amount, 2),
            "rent_advance_count": len(rent_advance),
            "rent_advance_amount": round(rent_advance_amount, 2),
            "majlis_short_count": len(majlis_short),
            "majlis_short_amount": round(majlis_short_amount, 2),
            "majlis_advance_count": len(majlis_advance),
            "majlis_advance_amount": round(majlis_advance_amount, 2),
        },
    }


@router.get("")
def cash_position(trust_id: int, db: Session = Depends(get_db)):
    return _cash_position_for_trust(trust_id, db)


@router.get("/all-trusts")
def all_trusts_position(db: Session = Depends(get_db)):
    trusts = db.query(Trust).all()
    result = []
    for t in trusts:
        pos = _cash_position_for_trust(t.id, db)
        result.append({
            "trust_id": t.id,
            "trust_name": t.name,
            "trust_code": t.code,
            **pos,
        })
    return result
