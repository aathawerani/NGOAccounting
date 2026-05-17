"""Fiscal year closing: calculate closing balances, create opening entries, archive."""

from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import and_
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, FiscalYearClose, LedgerEntry, Trust

router = APIRouter(prefix="/api/fiscal-year", tags=["fiscal-year"])


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fy_dates(year: int) -> tuple[date, date]:
    """Return (start, end) for Pakistani fiscal year ending in `year`.
    FY 2024 = 1 Jul 2023 – 30 Jun 2024."""
    return date(year - 1, 7, 1), date(year, 6, 30)


def _is_year_closed(trust_id: int, year: int, db: Session) -> bool:
    return db.query(FiscalYearClose).filter(
        FiscalYearClose.trust_id == trust_id,
        FiscalYearClose.fiscal_year == year,
    ).first() is not None


def _account_balance(trust_id: int, code: str, d_from: date, d_to: date, db: Session) -> float:
    entries = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.account_code == code,
        LedgerEntry.is_deleted == False,
        LedgerEntry.date >= d_from,
        LedgerEntry.date <= d_to,
    ).all()
    return sum(e.debit - e.credit for e in entries)


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.get("/closed-years")
def list_closed_years(trust_id: int, db: Session = Depends(get_db)):
    closes = (
        db.query(FiscalYearClose)
        .filter(FiscalYearClose.trust_id == trust_id)
        .order_by(FiscalYearClose.fiscal_year.desc())
        .all()
    )
    return [
        {
            "id": c.id,
            "fiscal_year": c.fiscal_year,
            "closed_at": c.closed_at.isoformat(),
            "net_surplus": c.net_surplus,
            "opening_entries_count": c.opening_entries_count,
            "note": c.closed_by_note,
        }
        for c in closes
    ]


@router.get("/preview")
def preview_close(trust_id: int, year: int, db: Session = Depends(get_db)):
    """Return a preview of what closing FY `year` would do (no DB changes)."""
    if _is_year_closed(trust_id, year, db):
        raise HTTPException(400, f"FY {year} is already closed")

    d_from, d_to = _fy_dates(year)
    accounts = db.query(AccountType).filter(AccountType.trust_id == trust_id).all()

    income_total = 0.0
    expense_total = 0.0
    balance_accounts = []

    for acct in accounts:
        bal = _account_balance(trust_id, acct.account_code, d_from, d_to, db)
        if acct.account_type == "INCOME":
            # INCOME accounts: credit balance is positive income
            income_total += -bal  # CR > DR → negative bal → flip sign
        elif acct.account_type == "EXPENSE":
            # EXPENSE accounts: debit balance is positive expense
            expense_total += bal
        elif acct.account_type in ("ASSET", "LIABILITY", "EQUITY", "CAPITAL"):
            if abs(bal) > 0.001:
                balance_accounts.append({
                    "code": acct.account_code,
                    "name": acct.account_name,
                    "type": acct.account_type,
                    "closing_balance": bal,
                })

    net_surplus = income_total - expense_total

    return {
        "fiscal_year": year,
        "period": {"from": d_from.isoformat(), "to": d_to.isoformat()},
        "income_total": income_total,
        "expense_total": expense_total,
        "net_surplus": net_surplus,
        "balance_accounts": balance_accounts,
        "opening_entries_to_create": len(balance_accounts),
        "already_closed": False,
    }


class CloseYearBody(BaseModel):
    trust_id: int
    fiscal_year: int
    note: Optional[str] = None


@router.post("/close")
def close_fiscal_year(body: CloseYearBody, db: Session = Depends(get_db)):
    """
    Perform year-end close:
    1. Book net surplus/deficit to GF (equity).
    2. Create opening balance entries (row_order=1) for the next FY for all
       ASSET / LIABILITY / EQUITY / CAPITAL accounts that have a non-zero balance.
    3. Record the FiscalYearClose row.
    """
    trust_id = body.trust_id
    year = body.fiscal_year

    if _is_year_closed(trust_id, year, db):
        raise HTTPException(400, f"FY {year} is already closed for this trust")

    trust = db.query(Trust).filter(Trust.id == trust_id).first()
    if not trust:
        raise HTTPException(404, "Trust not found")

    d_from, d_to = _fy_dates(year)
    next_fy_start = date(year, 7, 1)   # opening date for entries in next FY

    accounts = db.query(AccountType).filter(AccountType.trust_id == trust_id).all()
    acct_map = {a.account_code: a for a in accounts}

    income_total = 0.0
    expense_total = 0.0
    balance_items: list[tuple[AccountType, float]] = []

    for acct in accounts:
        bal = _account_balance(trust_id, acct.account_code, d_from, d_to, db)
        if acct.account_type == "INCOME":
            income_total += -bal
        elif acct.account_type == "EXPENSE":
            expense_total += bal
        elif acct.account_type in ("ASSET", "LIABILITY", "EQUITY", "CAPITAL"):
            if abs(bal) > 0.001:
                balance_items.append((acct, bal))

    net_surplus = income_total - expense_total

    # ── 1. Book closing surplus to GF ────────────────────────────────────────
    gf_acct = acct_map.get("GF")
    close_key = f"fyclose-{trust_id}-{year}"

    if gf_acct and abs(net_surplus) > 0.001:
        # Net surplus: GF CR (increases equity)
        # Net deficit: GF DR (decreases equity)
        gf_debit = max(-net_surplus, 0.0)
        gf_credit = max(net_surplus, 0.0)
        particulars = f"Year-end close FY{year}: net {'surplus' if net_surplus >= 0 else 'deficit'}"

        db.add(LedgerEntry(
            trust_id=trust_id,
            account_code="GF",
            date=d_to,
            particulars=particulars,
            debit=gf_debit,
            credit=gf_credit,
            contra_account_code="P&L",
            row_order=2,
            account_key=close_key,
            is_deleted=False,
        ))

    # ── 2. Create opening balance entries for next FY ────────────────────────
    opening_count = 0
    for acct, bal in balance_items:
        ob_key = f"ob-{trust_id}-{year + 1}-{acct.account_code}"
        # Remove existing opening entries for this account in next FY (idempotent)
        db.query(LedgerEntry).filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.account_code == acct.account_code,
            LedgerEntry.row_order == 1,
            LedgerEntry.date == next_fy_start,
            LedgerEntry.account_key == ob_key,
        ).delete()

        if acct.account_type == "ASSET":
            ob_debit = max(bal, 0.0)
            ob_credit = max(-bal, 0.0)
        else:  # LIABILITY, EQUITY, CAPITAL
            ob_debit = max(-bal, 0.0)
            ob_credit = max(bal, 0.0)

        db.add(LedgerEntry(
            trust_id=trust_id,
            account_code=acct.account_code,
            date=next_fy_start,
            particulars="Balance b/d",
            debit=ob_debit,
            credit=ob_credit,
            contra_account_code="",
            row_order=1,
            account_key=ob_key,
            is_deleted=False,
        ))
        opening_count += 1

    # ── 3. Record the close ───────────────────────────────────────────────────
    fc = FiscalYearClose(
        trust_id=trust_id,
        fiscal_year=year,
        closed_at=datetime.now(),
        net_surplus=net_surplus,
        opening_entries_count=opening_count,
        closed_by_note=body.note,
    )
    db.add(fc)
    db.commit()

    return {
        "ok": True,
        "fiscal_year": year,
        "net_surplus": net_surplus,
        "opening_entries_created": opening_count,
        "next_fy_start": next_fy_start.isoformat(),
    }


@router.get("/is-locked")
def is_entry_locked(trust_id: int, entry_date: date, db: Session = Depends(get_db)):
    """Check whether a given date falls inside a closed fiscal year."""
    # FY year: if month >= 7 → year+1, else year
    fy = entry_date.year + 1 if entry_date.month >= 7 else entry_date.year
    locked = _is_year_closed(trust_id, fy, db)
    return {"locked": locked, "fiscal_year": fy}
