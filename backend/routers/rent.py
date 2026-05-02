import calendar
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import or_, and_
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.models import LedgerEntry, RentReceipt, Tenant, Trust

router = APIRouter(prefix="/api/rent", tags=["rent"])


# ── Pydantic schemas ──────────────────────────────────────────────────────────

class RentReceiptBody(BaseModel):
    trust_id: int
    tenant_id: int
    date: date
    from_month: int     # 1–12
    from_year: int
    to_month: int       # 1–12
    to_year: int
    rent_arrears: float = 0.0
    water_arrears: float = 0.0


# ── Helpers ───────────────────────────────────────────────────────────────────

def _fmt(d: date) -> str:
    """WPF particulars date format: d/m/yyyy (no zero-padding)."""
    return f"{d.day}/{d.month}/{d.year}"


def _num_months(from_m: int, from_y: int, to_m: int, to_y: int) -> int:
    """Inclusive month count: Jan→Mar = 3."""
    return (to_y - from_y) * 12 + (to_m - from_m) + 1


def _next_serial(trust_id: int, db: Session) -> str:
    """3-digit zero-padded serial, increments from highest existing per trust."""
    last = (
        db.query(RentReceipt)
        .filter(RentReceipt.trust_id == trust_id)
        .order_by(RentReceipt.id.desc())
        .first()
    )
    if not last or not last.serial_no:
        return "001"
    try:
        num = int(last.serial_no)
        nxt = (num % 999) + 1
        return f"{nxt:03d}"
    except ValueError:
        return "001"


def _serialize(r: RentReceipt) -> dict:
    return {
        "id": r.id,
        "trust_id": r.trust_id,
        "tenant_id": r.tenant_id,
        "serial_no": r.serial_no,
        "date": r.date.isoformat() if r.date else None,
        "plot_code": r.plot_code,
        "space_type": r.space_type,
        "space_number": r.space_number,
        "monthly_rent": r.monthly_rent,
        "water_charge": r.water_charge,
        "tenant_name": r.tenant_name,
        "cnic": r.cnic,
        "from_date": r.from_date.isoformat() if r.from_date else None,
        "to_date": r.to_date.isoformat() if r.to_date else None,
        "rent_arrears": r.rent_arrears,
        "water_arrears": r.water_arrears,
        "total_rent": r.total_rent,
        "total_water": r.total_water,
        "total_amount": r.total_amount,
        "rent_particulars": r.rent_particulars,
        "water_particulars": r.water_particulars,
        "arrears_particulars": r.arrears_particulars,
        "water_arrears_particulars": r.water_arrears_particulars,
    }


def _recalc_last_paid(tenant_id: int, db: Session):
    """After a delete, update tenant.last_paid to the latest remaining receipt."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        return
    latest = (
        db.query(RentReceipt)
        .filter(RentReceipt.tenant_id == tenant_id)
        .order_by(RentReceipt.to_date.desc())
        .first()
    )
    if latest and latest.to_date:
        tenant.last_paid_month = latest.to_date.month
        tenant.last_paid_year = latest.to_date.year
    else:
        tenant.last_paid_month = None
        tenant.last_paid_year = None
    db.commit()


# ── Routes ────────────────────────────────────────────────────────────────────

@router.get("")
def list_receipts(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(RentReceipt).options(joinedload(RentReceipt.tenant))
    if trust_id is not None:
        q = q.filter(RentReceipt.trust_id == trust_id)
    return [_serialize(r) for r in q.order_by(RentReceipt.date.desc(), RentReceipt.id.desc()).all()]


@router.get("/next-serial")
def next_serial(trust_id: int, db: Session = Depends(get_db)):
    return {"serial_no": _next_serial(trust_id, db)}


@router.post("", status_code=201)
def create_receipt(body: RentReceiptBody, db: Session = Depends(get_db)):
    # Validate trust
    trust = db.query(Trust).filter(Trust.id == body.trust_id).first()
    if not trust:
        raise HTTPException(status_code=404, detail="Trust not found")

    # Validate tenant
    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    # Validate month range
    if body.from_year > body.to_year or (
        body.from_year == body.to_year and body.from_month > body.to_month
    ):
        raise HTTPException(status_code=400, detail="From date must be before or equal to To date")

    # Compute dates
    from_date = date(body.from_year, body.from_month, 1)
    last_day = calendar.monthrange(body.to_year, body.to_month)[1]
    to_date = date(body.to_year, body.to_month, last_day)

    # Compute amounts (WPF: inclusive month count)
    n = _num_months(body.from_month, body.from_year, body.to_month, body.to_year)
    total_rent = n * tenant.monthly_rent
    total_water = n * tenant.water_charge
    total_amount = total_rent + total_water + body.rent_arrears + body.water_arrears

    # WPF-format particulars strings
    space = f"{tenant.space_type or 'SPACE'} {tenant.space_number or ''}"
    rent_part = f"{space}, RENT @{int(tenant.monthly_rent)}, {_fmt(from_date)}-{_fmt(to_date)}"
    water_part = f"{space}, WATER @{int(tenant.water_charge)}, {_fmt(from_date)}-{_fmt(to_date)}"
    arrears_part = f"{space}, RENT AREARS"
    water_arrears_part = f"{space}, WATER AREARS"

    receipt = RentReceipt(
        trust_id=body.trust_id,
        tenant_id=body.tenant_id,
        serial_no=_next_serial(body.trust_id, db),
        date=body.date,
        plot_code=tenant.plot_code,
        space_type=tenant.space_type,
        space_number=tenant.space_number,
        monthly_rent=tenant.monthly_rent,
        water_charge=tenant.water_charge,
        tenant_name=tenant.name,
        cnic=tenant.cnic,
        from_date=from_date,
        to_date=to_date,
        rent_arrears=body.rent_arrears,
        water_arrears=body.water_arrears,
        total_rent=total_rent,
        total_water=total_water,
        total_amount=total_amount,
        rent_particulars=rent_part,
        water_particulars=water_part,
        arrears_particulars=arrears_part,
        water_arrears_particulars=water_arrears_part,
    )
    db.add(receipt)

    # Update tenant last paid
    tenant.last_paid_month = body.to_month
    tenant.last_paid_year = body.to_year

    db.commit()
    return _serialize(receipt)


@router.put("/{receipt_id}")
def update_receipt(receipt_id: int, body: RentReceiptBody, db: Session = Depends(get_db)):
    receipt = db.query(RentReceipt).filter(RentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")

    tenant = db.query(Tenant).filter(Tenant.id == body.tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")

    if body.from_year > body.to_year or (
        body.from_year == body.to_year and body.from_month > body.to_month
    ):
        raise HTTPException(status_code=400, detail="From date must be before or equal to To date")

    from_date = date(body.from_year, body.from_month, 1)
    last_day = calendar.monthrange(body.to_year, body.to_month)[1]
    to_date = date(body.to_year, body.to_month, last_day)

    n = _num_months(body.from_month, body.from_year, body.to_month, body.to_year)
    total_rent = n * tenant.monthly_rent
    total_water = n * tenant.water_charge
    total_amount = total_rent + total_water + body.rent_arrears + body.water_arrears

    space = f"{tenant.space_type or 'SPACE'} {tenant.space_number or ''}"
    receipt.date = body.date
    receipt.tenant_id = body.tenant_id
    receipt.plot_code = tenant.plot_code
    receipt.space_type = tenant.space_type
    receipt.space_number = tenant.space_number
    receipt.monthly_rent = tenant.monthly_rent
    receipt.water_charge = tenant.water_charge
    receipt.tenant_name = tenant.name
    receipt.cnic = tenant.cnic
    receipt.from_date = from_date
    receipt.to_date = to_date
    receipt.rent_arrears = body.rent_arrears
    receipt.water_arrears = body.water_arrears
    receipt.total_rent = total_rent
    receipt.total_water = total_water
    receipt.total_amount = total_amount
    receipt.rent_particulars = f"{space}, RENT @{int(tenant.monthly_rent)}, {_fmt(from_date)}-{_fmt(to_date)}"
    receipt.water_particulars = f"{space}, WATER @{int(tenant.water_charge)}, {_fmt(from_date)}-{_fmt(to_date)}"
    receipt.arrears_particulars = f"{space}, RENT AREARS"
    receipt.water_arrears_particulars = f"{space}, WATER AREARS"

    # Recalculate tenant last paid from all remaining receipts
    db.commit()
    _recalc_last_paid(body.tenant_id, db)
    db.refresh(receipt)
    return _serialize(receipt)


@router.get("/ledger-receipts")
def ledger_receipts(trust_id: int, db: Session = Depends(get_db)):
    """
    Return rent/water receipts that were imported from WPF ledger sheets.
    These live in ledger_entries where the CONTRA account is an R or W income account
    (not WT* water-tax expense accounts or WHT withholding-tax accounts).
    """
    entries = (
        db.query(LedgerEntry)
        .filter(
            LedgerEntry.trust_id == trust_id,
            LedgerEntry.party_name != None,
            LedgerEntry.party_name != "",
            or_(
                LedgerEntry.contra_account_code.like("R%"),
                and_(
                    LedgerEntry.contra_account_code.like("W%"),
                    ~LedgerEntry.contra_account_code.like("WT%"),
                    LedgerEntry.contra_account_code != "WHT",
                ),
            ),
        )
        .order_by(LedgerEntry.party_name, LedgerEntry.date, LedgerEntry.id)
        .all()
    )
    return [
        {
            "id":                  e.id,
            "date":                e.date.isoformat() if e.date else None,
            "receipt_no":          e.receipt_no,
            "contra_account_code": e.contra_account_code,
            "property":            e.contra_account_code[1:] if e.contra_account_code and len(e.contra_account_code) > 1 else None,
            "entry_type":          "water" if (e.contra_account_code or "")[:1].upper() == "W" else "rent",
            "party_name":          e.party_name,
            "amount":              e.debit if e.debit else e.credit,
            "particulars":         e.particulars,
        }
        for e in entries
    ]


@router.delete("/{receipt_id}", status_code=204)
def delete_receipt(receipt_id: int, db: Session = Depends(get_db)):
    receipt = db.query(RentReceipt).filter(RentReceipt.id == receipt_id).first()
    if not receipt:
        raise HTTPException(status_code=404, detail="Receipt not found")
    tenant_id = receipt.tenant_id
    db.delete(receipt)
    db.commit()
    if tenant_id:
        _recalc_last_paid(tenant_id, db)
