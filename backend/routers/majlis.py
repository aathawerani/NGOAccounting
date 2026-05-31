from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from database import get_db
from models.models import MajlisBill, Trust, LedgerEntry, AccountType
from pdf_utils import NGODoc, hijri_str, amount_in_words

router = APIRouter(prefix="/api/majlis", tags=["majlis"])


class MajlisBillBody(BaseModel):
    trust_id: int
    date: date
    debit_account_code: str = "CASH"
    cash_received: Optional[float] = None   # None = fully paid (= total)
    hijri_day: Optional[str] = None
    hijri_month: Optional[str] = None
    hijri_year: Optional[str] = None
    from_time: Optional[str] = None
    to_time: Optional[str] = None
    event_name: Optional[str] = None
    milk_qty: float = 0.0
    milk_price: float = 0.0
    sugar_qty: float = 0.0
    sugar_price: float = 0.0
    tea_qty: float = 0.0
    tea_price: float = 0.0
    saffron: float = 0.0
    cardamoms: float = 0.0
    pistachios: float = 0.0
    ice: float = 0.0
    essence: float = 0.0
    miscellaneous: float = 0.0
    miscellaneous_desc: Optional[str] = None
    particulars: Optional[str] = None
    lights_fans: float = 0.0
    gas: float = 0.0
    loud_speaker: float = 0.0
    molana: float = 0.0


def _cash_status(cash_received: float, total: float) -> str:
    if cash_received <= 0:
        return "ADVANCE"
    elif cash_received >= total:
        return "PAID"
    else:
        return "SHORT"


def _next_serial(trust_id: int, db: Session) -> str:
    last = (
        db.query(MajlisBill)
        .filter(MajlisBill.trust_id == trust_id)
        .order_by(MajlisBill.id.desc())
        .first()
    )
    if not last or not last.serial_no:
        return "001"
    try:
        num = int(last.serial_no)
        return f"{(num % 999) + 1:03d}"
    except ValueError:
        return "001"


def _next_bill_no(trust_code: str, year: int, trust_id: int, db: Session) -> str:
    """Generate next sequential bill_no like HVHT-MAJ-2025-0001."""
    prefix = f"{trust_code}-MAJ-{year}-"
    last = (
        db.query(MajlisBill)
        .filter(
            MajlisBill.trust_id == trust_id,
            MajlisBill.bill_no.like(f"{prefix}%"),
        )
        .order_by(MajlisBill.bill_no.desc())
        .first()
    )
    if not last or not last.bill_no:
        return f"{prefix}0001"
    try:
        suffix = int(last.bill_no.rsplit("-", 1)[-1])
        return f"{prefix}{suffix + 1:04d}"
    except (ValueError, IndexError):
        return f"{prefix}0001"


def _serialize(b: MajlisBill) -> dict:
    return {
        "id": b.id,
        "trust_id": b.trust_id,
        "date": b.date.isoformat() if b.date else None,
        "hijri_day": b.hijri_day,
        "hijri_month": b.hijri_month,
        "hijri_year": b.hijri_year,
        "serial_no": b.serial_no,
        "bill_no": b.bill_no,
        "from_time": b.from_time,
        "to_time": b.to_time,
        "event_name": b.event_name,
        "milk_qty": b.milk_qty,
        "milk_price": b.milk_price,
        "milk_total": b.milk_total,
        "sugar_qty": b.sugar_qty,
        "sugar_price": b.sugar_price,
        "sugar_total": b.sugar_total,
        "tea_qty": b.tea_qty,
        "tea_price": b.tea_price,
        "tea_total": b.tea_total,
        "saffron": b.saffron,
        "cardamoms": b.cardamoms,
        "pistachios": b.pistachios,
        "ice": b.ice,
        "essence": b.essence,
        "miscellaneous": b.miscellaneous,
        "miscellaneous_desc": b.miscellaneous_desc,
        "particulars": b.particulars,
        "lights_fans": b.lights_fans,
        "gas": b.gas,
        "loud_speaker": b.loud_speaker,
        "molana": b.molana,
        "total_amount": b.total_amount,
        "cash_received": b.cash_received,
        "cash_status": b.cash_status or "PAID",
        "shortfall": round(max(0.0, (b.total_amount or 0.0) - (b.cash_received or 0.0)), 2),
    }


def _calc_totals(body: MajlisBillBody):
    milk_total = body.milk_qty * body.milk_price
    sugar_total = body.sugar_qty * body.sugar_price
    tea_total = body.tea_qty * body.tea_price
    total = (
        milk_total + sugar_total + tea_total
        + body.saffron + body.cardamoms + body.pistachios
        + body.ice + body.essence + body.miscellaneous
        + body.lights_fans + body.gas + body.loud_speaker + body.molana
    )
    return milk_total, sugar_total, tea_total, total


def _delete_journal_entries(bill_id: int, db: Session):
    keys = [f"majl-{bill_id}", f"lchg-{bill_id}"]
    db.query(LedgerEntry).filter(LedgerEntry.account_key.in_(keys)).delete(synchronize_session=False)


def _create_journal_entries(bill: MajlisBill, debit_code: str, db: Session):
    """
    BIB Majlis accounting:
      CASH DR total_amount
      M-SUB CR (total - loud_speaker)
      L-CHGS CR loud_speaker (if > 0)
    """
    loud = bill.loud_speaker or 0.0
    bill_except_ls = (bill.total_amount or 0.0) - loud
    donor = bill.event_name or "DONOR"

    if bill_except_ls > 0:
        part = bill.particulars or f"RECEIVED FROM {donor} FOR MAJALIS"
        key = f"majl-{bill.id}"
        db.add(LedgerEntry(
            trust_id=bill.trust_id, account_code=debit_code, date=bill.date,
            contra_account_code="M-SUB", particulars=part,
            debit=bill_except_ls, credit=0.0, account_key=key,
        ))
        db.add(LedgerEntry(
            trust_id=bill.trust_id, account_code="M-SUB", date=bill.date,
            contra_account_code=debit_code, particulars=part,
            debit=0.0, credit=bill_except_ls, account_key=key,
        ))

    if loud > 0:
        part = f"RECEIVED FROM {donor} L/S CHGS"
        key = f"lchg-{bill.id}"
        db.add(LedgerEntry(
            trust_id=bill.trust_id, account_code=debit_code, date=bill.date,
            contra_account_code="L-CHGS", particulars=part,
            debit=loud, credit=0.0, account_key=key,
        ))
        db.add(LedgerEntry(
            trust_id=bill.trust_id, account_code="L-CHGS", date=bill.date,
            contra_account_code=debit_code, particulars=part,
            debit=0.0, credit=loud, account_key=key,
        ))


@router.get("")
def list_bills(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(MajlisBill)
    if trust_id is not None:
        q = q.filter(MajlisBill.trust_id == trust_id)
    return [_serialize(b) for b in q.order_by(MajlisBill.date.desc(), MajlisBill.id.desc()).all()]


@router.get("/next-serial")
def next_serial(trust_id: int, db: Session = Depends(get_db)):
    return {"serial_no": _next_serial(trust_id, db)}


@router.post("", status_code=201)
def create_bill(body: MajlisBillBody, db: Session = Depends(get_db)):
    trust = db.query(Trust).filter(Trust.id == body.trust_id).first()
    if not trust:
        raise HTTPException(status_code=404, detail="Trust not found")

    milk_total, sugar_total, tea_total, total = _calc_totals(body)

    cash_recv = body.cash_received if body.cash_received is not None else total

    bill = MajlisBill(
        trust_id=body.trust_id,
        date=body.date,
        hijri_day=body.hijri_day,
        hijri_month=body.hijri_month,
        hijri_year=body.hijri_year,
        serial_no=_next_serial(body.trust_id, db),
        bill_no=_next_bill_no(trust.code, body.date.year, body.trust_id, db),
        from_time=body.from_time,
        to_time=body.to_time,
        event_name=body.event_name,
        milk_qty=body.milk_qty,
        milk_price=body.milk_price,
        milk_total=milk_total,
        sugar_qty=body.sugar_qty,
        sugar_price=body.sugar_price,
        sugar_total=sugar_total,
        tea_qty=body.tea_qty,
        tea_price=body.tea_price,
        tea_total=tea_total,
        saffron=body.saffron,
        cardamoms=body.cardamoms,
        pistachios=body.pistachios,
        ice=body.ice,
        essence=body.essence,
        miscellaneous=body.miscellaneous,
        miscellaneous_desc=body.miscellaneous_desc,
        lights_fans=body.lights_fans,
        gas=body.gas,
        loud_speaker=body.loud_speaker,
        molana=body.molana,
        total_amount=total,
        cash_received=cash_recv,
        cash_status=_cash_status(cash_recv, total),
    )
    bill.particulars = body.particulars or f"RECEIVED FROM {(body.event_name or 'DONOR').upper()} FOR MAJALIS"
    db.add(bill)
    db.commit()
    db.refresh(bill)
    _create_journal_entries(bill, body.debit_account_code, db)
    db.commit()
    return _serialize(bill)


@router.put("/{bill_id}")
def update_bill(bill_id: int, body: MajlisBillBody, db: Session = Depends(get_db)):
    bill = db.query(MajlisBill).filter(MajlisBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")

    milk_total, sugar_total, tea_total, total = _calc_totals(body)

    bill.date = body.date
    bill.hijri_day = body.hijri_day
    bill.hijri_month = body.hijri_month
    bill.hijri_year = body.hijri_year
    bill.from_time = body.from_time
    bill.to_time = body.to_time
    bill.event_name = body.event_name
    bill.milk_qty = body.milk_qty
    bill.milk_price = body.milk_price
    bill.milk_total = milk_total
    bill.sugar_qty = body.sugar_qty
    bill.sugar_price = body.sugar_price
    bill.sugar_total = sugar_total
    bill.tea_qty = body.tea_qty
    bill.tea_price = body.tea_price
    bill.tea_total = tea_total
    bill.saffron = body.saffron
    bill.cardamoms = body.cardamoms
    bill.pistachios = body.pistachios
    bill.ice = body.ice
    bill.essence = body.essence
    bill.miscellaneous = body.miscellaneous
    bill.miscellaneous_desc = body.miscellaneous_desc
    bill.particulars = body.particulars or f"RECEIVED FROM {(body.event_name or 'DONOR').upper()} FOR MAJALIS"
    bill.lights_fans = body.lights_fans
    bill.gas = body.gas
    bill.loud_speaker = body.loud_speaker
    bill.molana = body.molana
    bill.total_amount = total
    cash_recv = body.cash_received if body.cash_received is not None else total
    bill.cash_received = cash_recv
    bill.cash_status = _cash_status(cash_recv, total)

    db.commit()
    db.refresh(bill)

    _delete_journal_entries(bill.id, db)
    _create_journal_entries(bill, body.debit_account_code, db)
    db.commit()

    return _serialize(bill)


@router.get("/receivables")
def list_receivables(trust_id: int, status: Optional[str] = None, db: Session = Depends(get_db)):
    """Return majlis bills with outstanding cash (SHORT or ADVANCE)."""
    q = db.query(MajlisBill).filter(
        MajlisBill.trust_id == trust_id,
        MajlisBill.cash_status.in_(["SHORT", "ADVANCE"]),
    )
    if status and status in ("SHORT", "ADVANCE"):
        q = q.filter(MajlisBill.cash_status == status)
    return [_serialize(b) for b in q.order_by(MajlisBill.date.desc()).all()]


class CollectBody(BaseModel):
    cash_received: float


@router.patch("/{bill_id}/collect")
def collect_bill(bill_id: int, body: CollectBody, db: Session = Depends(get_db)):
    """Update cash_received on a bill without re-issuing journal entries."""
    bill = db.query(MajlisBill).filter(MajlisBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    new_total = (bill.cash_received or 0.0) + body.cash_received
    bill.cash_received = min(new_total, bill.total_amount or new_total)
    bill.cash_status = _cash_status(bill.cash_received, bill.total_amount or 0.0)
    db.commit()
    db.refresh(bill)
    return _serialize(bill)


@router.delete("/{bill_id}", status_code=204)
def delete_bill(bill_id: int, db: Session = Depends(get_db)):
    bill = db.query(MajlisBill).filter(MajlisBill.id == bill_id).first()
    if not bill:
        raise HTTPException(status_code=404, detail="Bill not found")
    _delete_journal_entries(bill_id, db)
    db.delete(bill)
    db.commit()


@router.get("/{bill_id}/pdf")
def majlis_bill_pdf(bill_id: int, db: Session = Depends(get_db)):
    """Generate and return an A5 PDF for a single Majlis bill."""
    bill = (
        db.query(MajlisBill)
        .options(joinedload(MajlisBill.trust))
        .filter(MajlisBill.id == bill_id)
        .first()
    )
    if not bill:
        raise HTTPException(404, "Bill not found")

    trust = bill.trust
    trust_name = trust.name if trust else "Trust"
    trust_code = trust.code if trust else ""
    doc_date = bill.date.strftime("%d %B %Y") if bill.date else "—"

    # Hijri date: use stored fields if available, else auto-convert
    if bill.hijri_day and bill.hijri_month and bill.hijri_year:
        h_date = f"{bill.hijri_day} {bill.hijri_month} {bill.hijri_year} AH"
    else:
        h_date = hijri_str(bill.date) if bill.date else ""

    # Trust settings for address / logo
    address = ""
    logo_b64 = ""
    try:
        from models.models import TrustSettings
        ts = db.query(TrustSettings).filter(TrustSettings.trust_id == bill.trust_id).first()
        if ts:
            address = ts.address or ""
            logo_b64 = ts.logo_base64 or ""
    except Exception:
        pass

    doc = NGODoc(trust_name, trust_code, "MAJLIS BILL", address=address, logo_b64=logo_b64)
    doc.add_header(
        doc_number=bill.bill_no or f"MAJ-{bill_id}",
        doc_date=doc_date,
        hijri_date=h_date,
    )

    # Event details
    time_str = ""
    if bill.from_time or bill.to_time:
        time_str = f"{bill.from_time or ''} — {bill.to_time or ''}".strip(" —")

    kv = [("Event / Donor", bill.event_name or "—")]
    if time_str:
        kv.append(("Time", time_str))
    kv.append(("Particulars", bill.particulars or "—"))
    doc.add_kv_table(kv)

    # Line items — only show rows with non-zero amounts
    items = []
    if (bill.milk_total or 0.0) > 0:
        detail = f"{bill.milk_qty or 0:.2f} kg × PKR {bill.milk_price or 0:.2f}"
        items.append(("Milk", detail, bill.milk_total or 0.0))
    if (bill.sugar_total or 0.0) > 0:
        detail = f"{bill.sugar_qty or 0:.2f} kg × PKR {bill.sugar_price or 0:.2f}"
        items.append(("Sugar", detail, bill.sugar_total or 0.0))
    if (bill.tea_total or 0.0) > 0:
        detail = f"{bill.tea_qty or 0:.2f} kg × PKR {bill.tea_price or 0:.2f}"
        items.append(("Tea", detail, bill.tea_total or 0.0))
    for label, val in [
        ("Saffron",         bill.saffron),
        ("Cardamoms",       bill.cardamoms),
        ("Pistachios",      bill.pistachios),
        ("Ice",             bill.ice),
        ("Essence / Colour", bill.essence),
        ("Miscellaneous",   bill.miscellaneous),
        ("Lights & Fans",   bill.lights_fans),
        ("Gas",             bill.gas),
        ("Loud Speaker",    bill.loud_speaker),
        ("Molana",          bill.molana),
    ]:
        if (val or 0.0) > 0:
            sub = bill.miscellaneous_desc if label == "Miscellaneous" and bill.miscellaneous_desc else ""
            items.append((label, sub, val or 0.0))

    if not items:
        items.append(("Total Bill", "", bill.total_amount or 0.0))

    doc.add_line_items(items, total=bill.total_amount or 0.0, words=True)
    doc.add_payment_status_bar(
        cash_status=bill.cash_status or "PAID",
        cash_received=bill.cash_received or 0.0,
        total_amount=bill.total_amount or 0.0,
    )
    doc.add_signature()
    doc.add_footer_note(f"Generated by NGO Accounting System · {trust_name}")

    buf = doc.build()
    fname = f"majlis_{bill.bill_no or bill_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )
