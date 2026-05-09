"""In-app financial reports: Trial Balance, Income Statement, Balance Sheet."""
from collections import defaultdict
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, LedgerEntry, Trust

router = APIRouter(prefix="/api/reports", tags=["reports"])


def _totals(trust_id: int, date_from: Optional[date], date_to: Optional[date], db: Session):
    """Return {account_code: {debit, credit}} for filtered entries."""
    q = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.is_deleted == False,
    )
    if date_from:
        q = q.filter(LedgerEntry.date >= date_from)
    if date_to:
        q = q.filter(LedgerEntry.date <= date_to)

    sums = defaultdict(lambda: {"debit": 0.0, "credit": 0.0})
    for e in q.all():
        sums[e.account_code]["debit"] += e.debit
        sums[e.account_code]["credit"] += e.credit
    return sums


def _year_range(year: Optional[int]):
    if year:
        return date(year, 1, 1), date(year, 12, 31)
    return None, None


@router.get("/trial-balance")
def trial_balance(
    trust_id: int,
    year: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    if not db.query(Trust).filter(Trust.id == trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    if year:
        date_from, date_to = _year_range(year)

    accounts = db.query(AccountType).filter(AccountType.trust_id == trust_id).order_by(AccountType.account_name).all()
    sums = _totals(trust_id, date_from, date_to, db)

    rows = []
    total_dr = 0.0
    total_cr = 0.0
    for a in accounts:
        dr = round(sums[a.account_code]["debit"], 2)
        cr = round(sums[a.account_code]["credit"], 2)
        balance = round(dr - cr, 2)
        if dr == 0 and cr == 0:
            continue
        rows.append({
            "code": a.account_code,
            "name": a.account_name,
            "type": a.account_type,
            "debit": dr,
            "credit": cr,
            "balance": balance,
        })
        total_dr += dr
        total_cr += cr

    return {
        "accounts": rows,
        "total_debit": round(total_dr, 2),
        "total_credit": round(total_cr, 2),
    }


@router.get("/income-statement")
def income_statement(
    trust_id: int,
    year: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    if not db.query(Trust).filter(Trust.id == trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    if year:
        date_from, date_to = _year_range(year)

    accounts = db.query(AccountType).filter(AccountType.trust_id == trust_id).order_by(AccountType.account_name).all()
    sums = _totals(trust_id, date_from, date_to, db)

    income_rows = []
    expense_rows = []
    total_income = 0.0
    total_expense = 0.0

    for a in accounts:
        dr = sums[a.account_code]["debit"]
        cr = sums[a.account_code]["credit"]
        if a.account_type == "INCOME":
            amount = round(cr - dr, 2)
            income_rows.append({"code": a.account_code, "name": a.account_name, "amount": amount})
            total_income += amount
        elif a.account_type == "EXPENSE":
            amount = round(dr - cr, 2)
            expense_rows.append({"code": a.account_code, "name": a.account_name, "amount": amount})
            total_expense += amount

    return {
        "income": income_rows,
        "expenses": expense_rows,
        "total_income": round(total_income, 2),
        "total_expense": round(total_expense, 2),
        "net_surplus": round(total_income - total_expense, 2),
    }


@router.get("/balance-sheet")
def balance_sheet(
    trust_id: int,
    year: Optional[int] = None,
    date_from: Optional[date] = None,
    date_to: Optional[date] = None,
    db: Session = Depends(get_db),
):
    if not db.query(Trust).filter(Trust.id == trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    if year:
        date_from, date_to = _year_range(year)

    accounts = db.query(AccountType).filter(AccountType.trust_id == trust_id).order_by(AccountType.account_name).all()
    sums = _totals(trust_id, date_from, date_to, db)

    asset_rows, liab_rows, equity_rows = [], [], []
    total_assets = total_liab = total_equity = 0.0
    income_total = expense_total = 0.0

    for a in accounts:
        dr = sums[a.account_code]["debit"]
        cr = sums[a.account_code]["credit"]
        if a.account_type == "ASSET":
            net = round(dr - cr, 2)
            asset_rows.append({"code": a.account_code, "name": a.account_name, "amount": net})
            total_assets += net
        elif a.account_type == "LIABILITY":
            net = round(cr - dr, 2)
            liab_rows.append({"code": a.account_code, "name": a.account_name, "amount": net})
            total_liab += net
        elif a.account_type in ("EQUITY", "CAPITAL"):
            net = round(cr - dr, 2)
            equity_rows.append({"code": a.account_code, "name": a.account_name, "amount": net})
            total_equity += net
        elif a.account_type == "INCOME":
            income_total += cr - dr
        elif a.account_type == "EXPENSE":
            expense_total += dr - cr

    net_profit = round(income_total - expense_total, 2)

    return {
        "assets": asset_rows,
        "liabilities": liab_rows,
        "equity": equity_rows,
        "total_assets": round(total_assets, 2),
        "total_liab": round(total_liab, 2),
        "total_equity": round(total_equity, 2),
        "net_profit": net_profit,
        "total_liab_equity": round(total_liab + total_equity + net_profit, 2),
    }
