"""In-app financial reports: Trial Balance, Income Statement, Balance Sheet."""
from collections import defaultdict
from datetime import date, datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.lib.enums import TA_RIGHT, TA_CENTER, TA_LEFT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable,
)
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


# ── PDF helpers ───────────────────────────────────────────────────────────────

_DARK   = colors.HexColor("#1E293B")
_GREEN  = colors.HexColor("#16A34A")
_MID    = colors.HexColor("#64748B")
_LIGHT  = colors.HexColor("#F8FAFC")
_BORDER = colors.HexColor("#CBD5E1")

_PKR = lambda n: f"PKR {int(n):,}" if n else "—"


def _report_doc(buf, trust_name: str, title: str, period: str):
    """Return (doc, story, styles) for a report PDF."""
    doc = SimpleDocTemplate(
        buf, pagesize=A4,
        leftMargin=2*cm, rightMargin=2*cm,
        topMargin=1.5*cm, bottomMargin=1.5*cm,
        title=title,
    )
    ss = getSampleStyleSheet()

    def _sty(name, **kw):
        return ParagraphStyle(name, parent=ss["Normal"], **kw)

    stys = {
        "trust":   _sty("trust",   fontSize=14, fontName="Helvetica-Bold",
                         textColor=_DARK, alignment=TA_CENTER),
        "title":   _sty("title",   fontSize=11, fontName="Helvetica",
                         textColor=_MID, alignment=TA_CENTER),
        "period":  _sty("period",  fontSize=8,  fontName="Helvetica",
                         textColor=_MID, alignment=TA_CENTER),
        "section": _sty("section", fontSize=9,  fontName="Helvetica-Bold",
                         textColor=colors.white),
        "acct":    _sty("acct",    fontSize=9,  fontName="Helvetica",
                         textColor=_DARK),
        "total":   _sty("total",   fontSize=9,  fontName="Helvetica-Bold",
                         textColor=_DARK),
        "footer":  _sty("footer",  fontSize=7,  fontName="Helvetica",
                         textColor=_BORDER, alignment=TA_CENTER),
        "right":   _sty("right",   fontSize=9,  fontName="Helvetica",
                         textColor=_DARK, alignment=TA_RIGHT),
        "right_b": _sty("right_b", fontSize=9,  fontName="Helvetica-Bold",
                         textColor=_DARK, alignment=TA_RIGHT),
    }

    story = []
    story.append(Paragraph(trust_name, stys["trust"]))
    story.append(Spacer(1, 2*mm))
    story.append(Paragraph(title, stys["title"]))
    story.append(Paragraph(period, stys["period"]))
    story.append(Spacer(1, 2*mm))
    story.append(HRFlowable(width="100%", thickness=1.5, color=_GREEN, spaceAfter=4*mm))
    return doc, story, stys


def _section_row(label: str, stys) -> list:
    return [Table(
        [[Paragraph(label, stys["section"])]],
        colWidths=["100%"],
        style=TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _DARK),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (-1, -1), 6),
        ]),
    )]


def _account_rows(rows: list, stys, label_col_w: float, amt_col_w: float) -> list:
    """Convert list of {code,name,amount} to table rows."""
    data = []
    for r in rows:
        amt = r.get("amount", r.get("balance", 0))
        data.append([
            Paragraph(f"{r['code']} — {r['name']}", stys["acct"]),
            Paragraph(_PKR(amt), stys["right"]),
        ])
    return data


def _total_row(label: str, amount: float, stys) -> list:
    return [
        Paragraph(label, stys["total"]),
        Paragraph(_PKR(amount), stys["right_b"]),
    ]


def _build_report_table(data: list, col_widths: list) -> Table:
    t = Table(data, colWidths=col_widths)
    t.setStyle(TableStyle([
        ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
        ("TOPPADDING",     (0, 0), (-1, -1), 3),
        ("BOTTOMPADDING",  (0, 0), (-1, -1), 3),
        ("LINEBELOW",      (0, 0), (-1, -2), 0.3, _BORDER),
        ("ALIGN",          (1, 0), (1, -1), "RIGHT"),
    ]))
    return t


def _add_page_footer(canvas, doc):
    canvas.saveState()
    canvas.setFont("Helvetica", 7)
    canvas.setFillColor(_BORDER)
    ts = datetime.now().strftime("%d %b %Y %H:%M")
    canvas.drawCentredString(
        doc.pagesize[0] / 2,
        1*cm,
        f"Page {doc.page} · Generated {ts} · NGO Accounting System",
    )
    canvas.restoreState()


# ── PDF endpoint ──────────────────────────────────────────────────────────────

class ReportPDFBody(BaseModel):
    trust_id: int
    report_type: str          # "income-statement" | "balance-sheet" | "trial-balance"
    year: Optional[int] = None
    date_from: Optional[date] = None
    date_to: Optional[date] = None


@router.post("/pdf")
def report_pdf(body: ReportPDFBody, db: Session = Depends(get_db)):
    """Generate a formatted A4 PDF for income statement or balance sheet."""
    trust = db.query(Trust).filter(Trust.id == body.trust_id).first()
    if not trust:
        raise HTTPException(404, "Trust not found")

    d_from = body.date_from
    d_to = body.date_to
    if body.year:
        d_from, d_to = date(body.year, 1, 1), date(body.year, 12, 31)

    if d_from and d_to:
        period_str = f"{d_from.strftime('%d %b %Y')} — {d_to.strftime('%d %b %Y')}"
    elif body.year:
        period_str = f"Year {body.year}"
    else:
        period_str = "All Periods"

    accounts = db.query(AccountType).filter(
        AccountType.trust_id == body.trust_id
    ).order_by(AccountType.account_name).all()
    sums = _totals(body.trust_id, d_from, d_to, db)

    from io import BytesIO
    buf = BytesIO()

    if body.report_type == "income-statement":
        title = "INCOME STATEMENT"
        doc, story, stys = _report_doc(buf, trust.name, title, period_str)

        income_rows, expense_rows = [], []
        total_income = total_expense = 0.0
        for a in accounts:
            dr = sums[a.account_code]["debit"]
            cr = sums[a.account_code]["credit"]
            if a.account_type == "INCOME":
                amt = round(cr - dr, 2)
                income_rows.append({"code": a.account_code, "name": a.account_name, "amount": amt})
                total_income += amt
            elif a.account_type == "EXPENSE":
                amt = round(dr - cr, 2)
                expense_rows.append({"code": a.account_code, "name": a.account_name, "amount": amt})
                total_expense += amt

        net = round(total_income - total_expense, 2)
        pw = A4[0] - 4*cm
        lw, aw = pw * 0.72, pw * 0.28

        # Income
        story += _section_row("INCOME", stys)
        data = _account_rows(income_rows, stys, lw, aw)
        data.append(_total_row("Total Income", total_income, stys))
        story.append(_build_report_table(data, [lw, aw]))
        story.append(Spacer(1, 4*mm))

        # Expenses
        story += _section_row("EXPENSES", stys)
        data = _account_rows(expense_rows, stys, lw, aw)
        data.append(_total_row("Total Expenses", total_expense, stys))
        story.append(_build_report_table(data, [lw, aw]))
        story.append(Spacer(1, 4*mm))

        # Net Surplus/Deficit
        net_label = "NET SURPLUS" if net >= 0 else "NET DEFICIT"
        net_data = [[
            Paragraph(net_label, ParagraphStyle("nl", parent=stys["total"],
                      textColor=colors.white, fontSize=10)),
            Paragraph(_PKR(abs(net)), ParagraphStyle("nv", parent=stys["right_b"],
                      textColor=colors.white, fontSize=10)),
        ]]
        net_t = Table(net_data, colWidths=[lw, aw])
        net_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _GREEN if net >= 0 else colors.HexColor("#DC2626")),
            ("TOPPADDING",    (0, 0), (-1, -1), 6),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ("LEFTPADDING",   (0, 0), (0, -1), 8),
            ("RIGHTPADDING",  (-1, 0), (-1, -1), 8),
        ]))
        story.append(net_t)

    elif body.report_type == "balance-sheet":
        title = "BALANCE SHEET"
        doc, story, stys = _report_doc(buf, trust.name, title, period_str)

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
        total_le = round(total_liab + total_equity + net_profit, 2)

        pw = A4[0] - 4*cm
        half = pw / 2 - 3*mm
        lw, aw = half * 0.7, half * 0.3

        # Two-column layout: Assets | Liabilities + Equity
        def _side(section_label, rows, total, total_label):
            items = []
            items += _section_row(section_label, stys)
            data = _account_rows(rows, stys, lw, aw)
            if not data:
                data = [[Paragraph("—", stys["acct"]), Paragraph("—", stys["right"])]]
            data.append(_total_row(total_label, total, stys))
            items.append(_build_report_table(data, [lw, aw]))
            return items

        asset_items  = _side("ASSETS",  asset_rows, total_assets, "Total Assets")
        le_liab   = _side("LIABILITIES", liab_rows, total_liab, "Total Liabilities")
        le_eq     = _side("EQUITY / CAPITAL", equity_rows, total_equity, "Total Equity")

        # Append net profit row to equity side
        np_data = [[
            Paragraph("Net Profit / (Loss)", stys["acct"]),
            Paragraph(_PKR(net_profit), stys["right"]),
        ]]
        le_eq.append(_build_report_table(np_data, [lw, aw]))

        # Total liabilities + equity
        tot_le_data = [_total_row("Total Liab + Equity", total_le, stys)]
        le_eq.append(_build_report_table(tot_le_data, [lw, aw]))

        # Build combined table
        from reportlab.platypus import KeepTogether
        story.append(KeepTogether(asset_items))
        story.append(Spacer(1, 4*mm))
        for item in le_liab:
            story.append(item)
        story.append(Spacer(1, 2*mm))
        for item in le_eq:
            story.append(item)

    elif body.report_type == "trial-balance":
        title = "TRIAL BALANCE"
        doc, story, stys = _report_doc(buf, trust.name, title, period_str)

        pw = A4[0] - 4*cm
        col_widths = [pw * 0.12, pw * 0.48, pw * 0.13, pw * 0.13, pw * 0.14]

        # Header row
        hdr_data = [[
            Paragraph(h, ParagraphStyle("h", parent=stys["section"], fontSize=8))
            for h in ["Code", "Account", "Debit", "Credit", "Balance"]
        ]]
        hdr_t = Table(hdr_data, colWidths=col_widths)
        hdr_t.setStyle(TableStyle([
            ("BACKGROUND", (0, 0), (-1, -1), _DARK),
            ("TOPPADDING",    (0, 0), (-1, -1), 4),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ("LEFTPADDING",   (0, 0), (0, -1), 6),
        ]))
        story.append(hdr_t)

        data = []
        total_dr = total_cr = 0.0
        for a in accounts:
            dr = round(sums[a.account_code]["debit"], 2)
            cr = round(sums[a.account_code]["credit"], 2)
            bal = round(dr - cr, 2)
            if dr == 0 and cr == 0:
                continue
            data.append([
                Paragraph(a.account_code, stys["acct"]),
                Paragraph(a.account_name, stys["acct"]),
                Paragraph(_PKR(dr), stys["right"]),
                Paragraph(_PKR(cr), stys["right"]),
                Paragraph(_PKR(bal), stys["right_b"]),
            ])
            total_dr += dr
            total_cr += cr

        data.append([
            Paragraph("", stys["acct"]),
            Paragraph("TOTALS", stys["total"]),
            Paragraph(_PKR(total_dr), stys["right_b"]),
            Paragraph(_PKR(total_cr), stys["right_b"]),
            Paragraph("", stys["acct"]),
        ])

        t = Table(data, colWidths=col_widths)
        t.setStyle(TableStyle([
            ("VALIGN",         (0, 0), (-1, -1), "MIDDLE"),
            ("TOPPADDING",     (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING",  (0, 0), (-1, -1), 3),
            ("LINEBELOW",      (0, 0), (-1, -2), 0.3, _BORDER),
            ("LINEABOVE",      (0, -1), (-1, -1), 0.8, _DARK),
            ("BACKGROUND",     (0, -1), (-1, -1), _LIGHT),
            ("ALIGN",          (2, 0), (-1, -1), "RIGHT"),
        ]))
        story.append(t)

    else:
        raise HTTPException(400, f"Unknown report_type: {body.report_type}")

    story.append(Spacer(1, 6*mm))
    story.append(HRFlowable(width="100%", thickness=0.5, color=_BORDER))
    story.append(Spacer(1, 1*mm))
    ts = datetime.now().strftime("%d %b %Y %H:%M")
    story.append(Paragraph(
        f"Generated {ts} · NGO Accounting System · {trust.name}",
        stys["footer"],
    ))

    doc.build(story, onFirstPage=_add_page_footer, onLaterPages=_add_page_footer)
    buf.seek(0)

    fname = f"{trust.code}_{body.report_type}_{body.year or 'all'}.pdf"
    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={"Content-Disposition": f'inline; filename="{fname}"'},
    )
