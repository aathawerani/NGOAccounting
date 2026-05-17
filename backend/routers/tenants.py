import calendar
import re
from datetime import datetime as _dt
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy.orm import Session, joinedload

from audit import log_audit
from database import get_db
from models.models import LedgerEntry, RentReceipt, Tenant, Trust
from pdf_utils import NGODoc, hijri_str

router = APIRouter(prefix="/api/tenants", tags=["tenants"])


class TenantBody(BaseModel):
    trust_id: int
    name: str
    plot_code: Optional[str] = None
    space_type: Optional[str] = None    # "SHOP" or "FLAT"
    space_number: Optional[str] = None
    monthly_rent: float = 0.0
    water_charge: float = 0.0
    cnic: Optional[str] = None
    last_paid_month: Optional[int] = None
    last_paid_year: Optional[int] = None
    is_active: bool = True


def _serialize(t: Tenant) -> dict:
    return {
        "id": t.id,
        "trust_id": t.trust_id,
        "trust_code": t.trust.code if t.trust else None,
        "trust_name": t.trust.name if t.trust else None,
        "name": t.name,
        "plot_code": t.plot_code,
        "space_type": t.space_type,
        "space_number": t.space_number,
        "monthly_rent": t.monthly_rent,
        "water_charge": t.water_charge,
        "cnic": t.cnic,
        "last_paid_month": t.last_paid_month,
        "last_paid_year": t.last_paid_year,
        "is_active": t.is_active,
    }


@router.get("")
def list_tenants(trust_id: Optional[int] = None, db: Session = Depends(get_db)):
    q = db.query(Tenant).options(joinedload(Tenant.trust))
    if trust_id is not None:
        q = q.filter(Tenant.trust_id == trust_id)
    return [_serialize(t) for t in q.order_by(Tenant.name).all()]


@router.post("", status_code=201)
def create_tenant(body: TenantBody, db: Session = Depends(get_db)):
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")
    tenant = Tenant(**body.model_dump())
    db.add(tenant)
    db.commit()
    log_audit(db, "tenants", "create", record_id=tenant.id, trust_id=tenant.trust_id,
              description=f"Tenant '{tenant.name}' added")
    db.commit()
    tenant = (
        db.query(Tenant)
        .options(joinedload(Tenant.trust))
        .filter(Tenant.id == tenant.id)
        .first()
    )
    return _serialize(tenant)


@router.put("/{tenant_id}")
def update_tenant(tenant_id: int, body: TenantBody, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    if not db.query(Trust).filter(Trust.id == body.trust_id).first():
        raise HTTPException(status_code=404, detail="Trust not found")
    for k, v in body.model_dump().items():
        setattr(tenant, k, v)
    log_audit(db, "tenants", "update", record_id=tenant_id, trust_id=tenant.trust_id,
              description=f"Tenant '{tenant.name}' updated")
    db.commit()
    tenant = (
        db.query(Tenant)
        .options(joinedload(Tenant.trust))
        .filter(Tenant.id == tenant_id)
        .first()
    )
    return _serialize(tenant)


@router.delete("/{tenant_id}", status_code=204)
def delete_tenant(tenant_id: int, db: Session = Depends(get_db)):
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(status_code=404, detail="Tenant not found")
    log_audit(db, "tenants", "delete", record_id=tenant_id, trust_id=tenant.trust_id,
              description=f"Tenant '{tenant.name}' deleted")
    db.delete(tenant)
    db.commit()


@router.post("/backfill-rates")
def backfill_rates(trust_id: int, db: Session = Depends(get_db)):
    """Parse RENT @N and WATER @N from ledger particulars to populate tenant rates (only fills 0-rate fields)."""
    tenants = db.query(Tenant).filter(Tenant.trust_id == trust_id).all()
    if not tenants:
        return {"updated": 0, "results": []}

    entries = db.query(LedgerEntry).filter(
        LedgerEntry.trust_id == trust_id,
        LedgerEntry.is_deleted == False,
    ).all()

    rent_re = re.compile(r'RENT\s+@\s*(\d+)', re.IGNORECASE)
    water_re = re.compile(r'WATER\s+@\s*(\d+)', re.IGNORECASE)

    party_rates: dict[str, dict] = {}
    for e in entries:
        if not e.party_name or not e.particulars:
            continue
        key = e.party_name.strip().upper()
        rm = rent_re.search(e.particulars)
        if rm:
            r = int(rm.group(1))
            party_rates.setdefault(key, {})
            party_rates[key]["rent"] = max(party_rates[key].get("rent", 0), r)
        wm = water_re.search(e.particulars)
        if wm:
            r = int(wm.group(1))
            party_rates.setdefault(key, {})
            party_rates[key]["water"] = max(party_rates[key].get("water", 0), r)

    updated = 0
    results = []
    for tenant in tenants:
        key = tenant.name.strip().upper()
        rates = party_rates.get(key, {})
        changed = False
        if rates.get("rent", 0) > 0 and (tenant.monthly_rent or 0) == 0:
            tenant.monthly_rent = float(rates["rent"])
            changed = True
        if rates.get("water", 0) > 0 and (tenant.water_charge or 0) == 0:
            tenant.water_charge = float(rates["water"])
            changed = True
        if changed:
            updated += 1
            results.append({
                "name": tenant.name,
                "monthly_rent": tenant.monthly_rent,
                "water_charge": tenant.water_charge,
            })

    if updated:
        db.commit()
    return {"updated": updated, "results": results}


# ── Tenant Statement ──────────────────────────────────────────────────────────

MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"]


@router.get("/{tenant_id}/statement")
def tenant_statement(
    tenant_id: int,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """Month-by-month rent/water statement for a tenant."""
    tenant = db.query(Tenant).filter(Tenant.id == tenant_id).first()
    if not tenant:
        raise HTTPException(404, "Tenant not found")

    q = db.query(RentReceipt).filter(
        RentReceipt.tenant_id == tenant_id,
        RentReceipt.trust_id == tenant.trust_id,
    )
    if year:
        q = q.filter(
            RentReceipt.from_date != None,
        ).filter(
            RentReceipt.date >= _dt(year, 1, 1).date(),
            RentReceipt.date <= _dt(year, 12, 31).date(),
        )
    receipts = q.order_by(RentReceipt.date).all()

    rows = []
    running_arrears = 0.0
    for r in receipts:
        rent_due = (tenant.monthly_rent or 0.0)
        water_due = (tenant.water_charge or 0.0)
        rent_paid = r.total_rent or 0.0
        water_paid = r.total_water or 0.0
        rent_arrears_paid = r.rent_arrears or 0.0
        water_arrears_paid = r.water_arrears or 0.0
        total_paid = r.total_amount or 0.0
        running_arrears = max(0.0, running_arrears + rent_due + water_due - total_paid)
        rows.append({
            "receipt_id": r.id,
            "serial_no": r.serial_no,
            "date": r.date.isoformat() if r.date else None,
            "period": (
                f"{MONTHS[(r.from_date.month - 1) if r.from_date else 0]} "
                f"{r.from_date.year if r.from_date else ''}"
                if r.from_date else "—"
            ),
            "rent_due": rent_due,
            "water_due": water_due,
            "rent_paid": rent_paid,
            "water_paid": water_paid,
            "arrears_paid": rent_arrears_paid + water_arrears_paid,
            "total_paid": total_paid,
            "running_arrears": round(running_arrears, 2),
        })

    trust = db.query(Trust).filter(Trust.id == tenant.trust_id).first()
    return {
        "tenant": {
            "id": tenant.id,
            "name": tenant.name,
            "plot_code": tenant.plot_code,
            "space_type": tenant.space_type,
            "space_number": tenant.space_number,
            "monthly_rent": tenant.monthly_rent,
            "water_charge": tenant.water_charge,
        },
        "trust_name": trust.name if trust else "",
        "trust_code": trust.code if trust else "",
        "year": year,
        "rows": rows,
        "total_paid": round(sum(r["total_paid"] for r in rows), 2),
        "receipts_count": len(rows),
    }


@router.get("/{tenant_id}/statement/pdf")
def tenant_statement_pdf(
    tenant_id: int,
    year: Optional[int] = None,
    db: Session = Depends(get_db),
):
    """A4 PDF of the tenant statement."""
    data = tenant_statement(tenant_id, year, db)
    tenant_info = data["tenant"]
    trust_name = data["trust_name"]
    trust_code = data["trust_code"]
    year_label = str(year) if year else "All Periods"
    property_str = (
        f"{tenant_info.get('space_type','')} {tenant_info.get('space_number','')} "
        f"@ {tenant_info.get('plot_code','')}"
    ).strip()

    from io import BytesIO
    from reportlab.lib.pagesizes import A4
    from reportlab.lib import colors
    from reportlab.lib.units import cm, mm
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib.enums import TA_RIGHT, TA_CENTER
    from reportlab.platypus import (
        SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle, HRFlowable,
    )

    DARK   = colors.HexColor("#1E293B")
    GREEN  = colors.HexColor("#16A34A")
    MID    = colors.HexColor("#64748B")
    LIGHT  = colors.HexColor("#F8FAFC")
    BORDER = colors.HexColor("#CBD5E1")
    WHITE  = colors.white

    buf = BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4,
                            leftMargin=2*cm, rightMargin=2*cm,
                            topMargin=1.5*cm, bottomMargin=1.5*cm)
    ss = getSampleStyleSheet()
    def S(name, **kw):
        return ParagraphStyle(name, parent=ss["Normal"], **kw)

    stys = {
        "trust":  S("trust",  fontSize=13, fontName="Helvetica-Bold", textColor=DARK, alignment=TA_CENTER),
        "title":  S("title",  fontSize=10, fontName="Helvetica",       textColor=MID,  alignment=TA_CENTER),
        "hdr":    S("hdr",    fontSize=8,  fontName="Helvetica-Bold",  textColor=WHITE),
        "cell":   S("cell",   fontSize=8,  fontName="Helvetica",       textColor=DARK),
        "cell_r": S("cell_r", fontSize=8,  fontName="Helvetica",       textColor=DARK,  alignment=TA_RIGHT),
        "bold_r": S("bold_r", fontSize=8,  fontName="Helvetica-Bold",  textColor=DARK,  alignment=TA_RIGHT),
        "footer": S("footer", fontSize=7,  fontName="Helvetica",       textColor=BORDER, alignment=TA_CENTER),
        "kv_lbl": S("kv_lbl", fontSize=8,  fontName="Helvetica",       textColor=MID),
        "kv_val": S("kv_val", fontSize=8,  fontName="Helvetica-Bold",  textColor=DARK),
    }

    PKR = lambda n: f"PKR {int(n):,}" if n else "—"
    story = []

    story.append(Paragraph(trust_name, stys["trust"]))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph("TENANT RENT STATEMENT", stys["title"]))
    story.append(Paragraph(f"Period: {year_label}", stys["title"]))
    story.append(Spacer(1, 2*mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=GREEN, spaceAfter=3*mm))

    # Tenant meta
    pw = A4[0] - 4*cm
    meta_data = [
        [Paragraph("Tenant", stys["kv_lbl"]), Paragraph(tenant_info["name"], stys["kv_val"]),
         Paragraph("Property", stys["kv_lbl"]), Paragraph(property_str or "—", stys["kv_val"])],
        [Paragraph("Monthly Rent", stys["kv_lbl"]), Paragraph(PKR(tenant_info["monthly_rent"] or 0), stys["kv_val"]),
         Paragraph("Water Charge", stys["kv_lbl"]), Paragraph(PKR(tenant_info["water_charge"] or 0), stys["kv_val"])],
    ]
    meta_t = Table(meta_data, colWidths=[pw*0.18, pw*0.32, pw*0.18, pw*0.32])
    meta_t.setStyle(TableStyle([
        ("VALIGN", (0,0),(-1,-1),"TOP"),
        ("TOPPADDING",    (0,0),(-1,-1), 3),
        ("BOTTOMPADDING", (0,0),(-1,-1), 3),
        ("LINEBELOW",     (0,0),(-1,-2), 0.3, BORDER),
    ]))
    story.append(meta_t)
    story.append(Spacer(1, 4*mm))

    # Table header
    col_widths = [pw*0.08, pw*0.12, pw*0.14, pw*0.13, pw*0.13, pw*0.12, pw*0.13, pw*0.15]
    headers = ["Serial", "Date", "Period", "Rent Due", "Water Due", "Rent Paid", "Water Paid", "Total Paid"]
    hdr_row = [Paragraph(h, stys["hdr"]) for h in headers]
    hdr_t = Table([hdr_row], colWidths=col_widths)
    hdr_t.setStyle(TableStyle([
        ("BACKGROUND", (0,0),(-1,-1), DARK),
        ("TOPPADDING",    (0,0),(-1,-1), 4),
        ("BOTTOMPADDING", (0,0),(-1,-1), 4),
        ("LEFTPADDING",   (0,0),(0,-1), 4),
        ("ALIGN",         (3,0),(-1,-1), "RIGHT"),
    ]))
    story.append(hdr_t)

    # Data rows
    table_data = []
    for row in data["rows"]:
        table_data.append([
            Paragraph(row["serial_no"] or "—", stys["cell"]),
            Paragraph(row["date"] or "—", stys["cell"]),
            Paragraph(row["period"], stys["cell"]),
            Paragraph(PKR(row["rent_due"]), stys["cell_r"]),
            Paragraph(PKR(row["water_due"]), stys["cell_r"]),
            Paragraph(PKR(row["rent_paid"]), stys["cell_r"]),
            Paragraph(PKR(row["water_paid"]), stys["cell_r"]),
            Paragraph(PKR(row["total_paid"]), stys["bold_r"]),
        ])

    if not table_data:
        table_data = [[Paragraph("No receipts found for this period.", stys["cell"])] + [""] * 7]

    # Total row
    table_data.append([
        Paragraph("", stys["cell"]),
        Paragraph("", stys["cell"]),
        Paragraph("TOTAL", stys["kv_val"]),
        Paragraph("", stys["cell"]),
        Paragraph("", stys["cell"]),
        Paragraph("", stys["cell"]),
        Paragraph("", stys["cell"]),
        Paragraph(PKR(data["total_paid"]), stys["bold_r"]),
    ])

    dt = Table(table_data, colWidths=col_widths)
    dt.setStyle(TableStyle([
        ("VALIGN",         (0,0),(-1,-1), "MIDDLE"),
        ("TOPPADDING",     (0,0),(-1,-1), 3),
        ("BOTTOMPADDING",  (0,0),(-1,-1), 3),
        ("LINEBELOW",      (0,0),(-1,-2), 0.3, BORDER),
        ("LINEABOVE",      (0,-1),(-1,-1), 0.8, DARK),
        ("BACKGROUND",     (0,-1),(-1,-1), LIGHT),
        ("ALIGN",          (3,0),(-1,-1), "RIGHT"),
    ]))
    story.append(dt)

    story.append(Spacer(1, 6*mm))
    ts = _dt.now().strftime("%d %b %Y %H:%M")
    story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
    story.append(Spacer(1, 1*mm))
    story.append(Paragraph(f"Generated {ts} · NGO Accounting System · {trust_name}", stys["footer"]))

    doc.build(story)
    buf.seek(0)

    fname = f"statement_{tenant_info['name'].replace(' ', '_')}_{year_label}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )
