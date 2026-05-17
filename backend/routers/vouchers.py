from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from audit import log_audit
from database import get_db
from models.models import AccountType, LedgerEntry, Trust, Voucher
from pdf_utils import NGODoc, hijri_str, amount_in_words

router = APIRouter(prefix="/api/vouchers", tags=["vouchers"])


class VoucherBody(BaseModel):
    trust_id: int
    date: date
    voucher_type: str = "Payment"       # "Payment" | "Receipt"
    account_code: str                    # DR (Payment) or CR (Receipt) account code
    contra_account_code: str = "CASH"   # CR (Payment) or DR (Receipt) account code
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
        "voucher_type": v.voucher_type or "Payment",
        "account_code": v.account_code,
        "account_name": v.account_name,
        "contra_account_code": v.contra_account_code,
        "being": v.being,
        "amount": v.amount,
    }


def _delete_journal_entries(voucher_id: int, db: Session):
    db.query(LedgerEntry).filter(
        LedgerEntry.account_key == f"vouc-{voucher_id}"
    ).delete(synchronize_session=False)


def _create_journal_entries(voucher: Voucher, db: Session):
    """
    Payment: account_code DR, contra_account_code CR
    Receipt: contra_account_code DR, account_code CR
    """
    key = f"vouc-{voucher.id}"
    particulars = voucher.being or f"{voucher.voucher_type} voucher"
    amt = voucher.amount or 0.0

    if voucher.voucher_type == "Receipt":
        dr_code = voucher.contra_account_code
        cr_code = voucher.account_code
    else:  # Payment (default)
        dr_code = voucher.account_code
        cr_code = voucher.contra_account_code

    db.add(LedgerEntry(
        trust_id=voucher.trust_id, account_code=dr_code, date=voucher.date,
        receipt_no=voucher.voucher_number, party_name=None,
        contra_account_code=cr_code, particulars=particulars,
        debit=amt, credit=0.0, account_key=key,
    ))
    db.add(LedgerEntry(
        trust_id=voucher.trust_id, account_code=cr_code, date=voucher.date,
        receipt_no=voucher.voucher_number, party_name=None,
        contra_account_code=dr_code, particulars=particulars,
        debit=0.0, credit=amt, account_key=key,
    ))


@router.get("")
def list_vouchers(trust_id: Optional[int] = None, voucher_type: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(Voucher)
    if trust_id is not None:
        q = q.filter(Voucher.trust_id == trust_id)
    if voucher_type is not None:
        q = q.filter(Voucher.voucher_type == voucher_type)
    return [_serialize(v) for v in q.order_by(Voucher.date.desc(), Voucher.id.desc()).all()]


@router.get("/next-number")
def next_number(trust_id: int, db: Session = Depends(get_db)):
    return {"voucher_number": _next_voucher_no(trust_id, db)}


@router.post("", status_code=201)
def create_voucher(body: VoucherBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")

    acct = db.query(AccountType).filter(
        AccountType.trust_id == body.trust_id,
        AccountType.account_code == body.account_code,
    ).first()
    account_name = acct.account_name if acct else body.account_code

    v = Voucher(
        trust_id=body.trust_id,
        date=body.date,
        voucher_number=_next_voucher_no(body.trust_id, db),
        voucher_type=body.voucher_type,
        account_code=body.account_code,
        account_name=account_name,
        contra_account_code=body.contra_account_code,
        being=body.being,
        amount=body.amount,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    _create_journal_entries(v, db)
    log_audit(db, "vouchers", "create", record_id=v.id, trust_id=v.trust_id,
              description=f"Voucher {v.voucher_number} created: {v.account_code} ↔ {v.contra_account_code} PKR {v.amount:,.0f}")
    db.commit()
    return _serialize(v)


@router.put("/{voucher_id}")
def update_voucher(voucher_id: int, body: VoucherBody, db: Session = Depends(get_db)):
    v = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher not found")

    acct = db.query(AccountType).filter(
        AccountType.trust_id == body.trust_id,
        AccountType.account_code == body.account_code,
    ).first()
    account_name = acct.account_name if acct else body.account_code

    v.date = body.date
    v.voucher_type = body.voucher_type
    v.account_code = body.account_code
    v.account_name = account_name
    v.contra_account_code = body.contra_account_code
    v.being = body.being
    v.amount = body.amount

    db.commit()
    db.refresh(v)

    _delete_journal_entries(v.id, db)
    _create_journal_entries(v, db)
    log_audit(db, "vouchers", "update", record_id=v.id, trust_id=v.trust_id,
              description=f"Voucher {v.voucher_number} updated: {v.account_code} ↔ {v.contra_account_code} PKR {v.amount:,.0f}")
    db.commit()

    return _serialize(v)


@router.delete("/{voucher_id}", status_code=204)
def delete_voucher(voucher_id: int, db: Session = Depends(get_db)):
    v = db.query(Voucher).filter(Voucher.id == voucher_id).first()
    if not v:
        raise HTTPException(status_code=404, detail="Voucher not found")
    _delete_journal_entries(voucher_id, db)
    log_audit(db, "vouchers", "delete", record_id=voucher_id, trust_id=v.trust_id,
              description=f"Voucher {v.voucher_number} deleted: {v.account_code} PKR {v.amount:,.0f}")
    db.delete(v)
    db.commit()


@router.get("/{voucher_id}/pdf")
def voucher_pdf(voucher_id: int, db: Session = Depends(get_db)):
    """Generate and return an A5 PDF for a single voucher."""
    v = (
        db.query(Voucher)
        .options(joinedload(Voucher.trust))
        .filter(Voucher.id == voucher_id)
        .first()
    )
    if not v:
        raise HTTPException(404, "Voucher not found")

    trust = v.trust
    trust_name = trust.name if trust else "Trust"
    trust_code = trust.code if trust else ""
    is_payment = (v.voucher_type or "Payment") == "Payment"
    doc_title = "PAYMENT VOUCHER" if is_payment else "RECEIPT VOUCHER"
    doc_date = v.date.strftime("%d %B %Y") if v.date else "—"
    h_date = hijri_str(v.date) if v.date else ""

    # Resolve account names
    def _acct_name(code: str) -> str:
        if not code:
            return "—"
        a = db.query(AccountType).filter(
            AccountType.trust_id == v.trust_id,
            AccountType.account_code == code,
        ).first()
        return f"{a.account_name} ({code})" if a else code

    if is_payment:
        dr_code = v.account_code or "—"
        cr_code = v.contra_account_code or "CASH"
    else:
        dr_code = v.contra_account_code or "CASH"
        cr_code = v.account_code or "—"

    doc = NGODoc(trust_name, trust_code, doc_title)
    doc.add_header(
        doc_number=v.voucher_number or f"V-{voucher_id}",
        doc_date=doc_date,
        hijri_date=h_date,
    )
    doc.add_kv_table([
        ("Voucher Type", v.voucher_type or "Payment"),
        ("Debit Account (DR)", _acct_name(dr_code)),
        ("Credit Account (CR)", _acct_name(cr_code)),
        ("Being / Particulars", v.being or "—"),
    ])
    doc.add_line_items(
        [(v.being or "Amount", v.voucher_type or "", v.amount or 0.0)],
        total=v.amount or 0.0,
        words=True,
    )
    doc.add_signature()
    doc.add_footer_note(
        f"Generated by NGO Accounting System · {trust_name}"
    )

    buf = doc.build()
    fname = f"voucher_{v.voucher_number or voucher_id}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )
