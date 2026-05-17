"""Shared PDF helpers for voucher / receipt / report generation (reportlab)."""

from io import BytesIO
from datetime import date as _date_type

from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER, TA_RIGHT, TA_LEFT
from reportlab.lib.pagesizes import A4, A5
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.units import cm, mm
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    HRFlowable, KeepTogether,
)
from reportlab.platypus import PageBreak


# ── Palette ────────────────────────────────────────────────────────────────────

DARK    = colors.HexColor("#1E293B")   # slate-800
GREEN   = colors.HexColor("#16A34A")   # green-600
LIGHT   = colors.HexColor("#F8FAFC")   # slate-50
MID     = colors.HexColor("#64748B")   # slate-500
BORDER  = colors.HexColor("#CBD5E1")   # slate-300
WHITE   = colors.white
RED     = colors.HexColor("#DC2626")


# ── Amount in words (English) ──────────────────────────────────────────────────

_ONES  = ["", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight",
          "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen",
          "Sixteen", "Seventeen", "Eighteen", "Nineteen"]
_TENS  = ["", "", "Twenty", "Thirty", "Forty", "Fifty",
          "Sixty", "Seventy", "Eighty", "Ninety"]


def _chunk(n: int) -> str:
    if n == 0:
        return ""
    elif n < 20:
        return _ONES[n]
    elif n < 100:
        return _TENS[n // 10] + (" " + _ONES[n % 10] if n % 10 else "")
    else:
        rem = n % 100
        return _ONES[n // 100] + " Hundred" + (" and " + _chunk(rem) if rem else "")


def amount_in_words(amount: float) -> str:
    """Convert PKR amount to English words (Pakistani system)."""
    n = int(round(amount))
    if n == 0:
        return "Zero Rupees Only"
    parts = []
    # Pakistani denomination: Crore > Lakh > Thousand > remainder (max 999)
    for divisor, mod, name in [
        (10_000_000, None,  "Crore"),
        (100_000,    100,   "Lakh"),
        (1_000,      100,   "Thousand"),
        (1,          1_000, ""),
    ]:
        q = n // divisor
        chunk = q if mod is None else q % mod
        if chunk:
            parts.append(f"{_chunk(chunk)} {name}".strip())
    return "PKR " + " ".join(p for p in parts if p) + " Only"


# ── Hijri helper ───────────────────────────────────────────────────────────────

def hijri_str(d: _date_type) -> str:
    try:
        from hijri_converter import convert
        h = convert.Gregorian(d.year, d.month, d.day).to_hijri()
        return h.dmyformat()
    except Exception:
        return ""


# ── Document builder ───────────────────────────────────────────────────────────

class NGODoc:
    """
    Thin wrapper around SimpleDocTemplate that provides:
    - Letterhead (trust name + doc title + divider)
    - Key-value row builder
    - Amount row builder
    - Totals row
    - Signature block
    Returns a BytesIO with a finished PDF.
    """

    def __init__(self, trust_name: str, trust_code: str,
                 doc_title: str, pagesize=A5):
        self.trust_name = trust_name
        self.trust_code = trust_code
        self.doc_title  = doc_title
        self.pagesize   = pagesize
        self._buf = BytesIO()
        self._story: list = []

        # Margins
        m = 1.5 * cm
        self._doc = SimpleDocTemplate(
            self._buf,
            pagesize=pagesize,
            leftMargin=m, rightMargin=m,
            topMargin=m, bottomMargin=m,
            title=doc_title,
        )

        # Base styles
        ss = getSampleStyleSheet()
        self.S = {
            "header_trust": ParagraphStyle(
                "header_trust", parent=ss["Normal"],
                fontSize=13, leading=16, textColor=DARK,
                fontName="Helvetica-Bold", alignment=TA_CENTER,
            ),
            "header_title": ParagraphStyle(
                "header_title", parent=ss["Normal"],
                fontSize=10, leading=13, textColor=MID,
                fontName="Helvetica", alignment=TA_CENTER,
            ),
            "label": ParagraphStyle(
                "label", parent=ss["Normal"],
                fontSize=8, leading=11, textColor=MID,
                fontName="Helvetica",
            ),
            "value": ParagraphStyle(
                "value", parent=ss["Normal"],
                fontSize=9, leading=12, textColor=DARK,
                fontName="Helvetica-Bold",
            ),
            "value_normal": ParagraphStyle(
                "value_normal", parent=ss["Normal"],
                fontSize=9, leading=12, textColor=DARK,
                fontName="Helvetica",
            ),
            "total_label": ParagraphStyle(
                "total_label", parent=ss["Normal"],
                fontSize=9, leading=12, textColor=WHITE,
                fontName="Helvetica-Bold",
            ),
            "total_value": ParagraphStyle(
                "total_value", parent=ss["Normal"],
                fontSize=10, leading=13, textColor=WHITE,
                fontName="Helvetica-Bold", alignment=TA_RIGHT,
            ),
            "words": ParagraphStyle(
                "words", parent=ss["Normal"],
                fontSize=7.5, leading=10, textColor=MID,
                fontName="Helvetica-Oblique", alignment=TA_CENTER,
            ),
            "sig_label": ParagraphStyle(
                "sig_label", parent=ss["Normal"],
                fontSize=7.5, leading=10, textColor=MID,
                fontName="Helvetica", alignment=TA_CENTER,
            ),
            "footer": ParagraphStyle(
                "footer", parent=ss["Normal"],
                fontSize=7, leading=9, textColor=BORDER,
                fontName="Helvetica", alignment=TA_CENTER,
            ),
        }

    # ── Letterhead ─────────────────────────────────────────────────────────────

    def add_header(self, doc_number: str = "", doc_date: str = "",
                   hijri_date: str = ""):
        s = self._story
        s.append(Paragraph(self.trust_name, self.S["header_trust"]))
        s.append(Spacer(1, 2 * mm))
        s.append(Paragraph(self.doc_title, self.S["header_title"]))
        s.append(Spacer(1, 2 * mm))
        s.append(HRFlowable(width="100%", thickness=1.5, color=GREEN,
                             spaceAfter=3 * mm))

        # Meta row
        meta = []
        if doc_number:
            meta.append(f"<b>No.</b> {doc_number}")
        if doc_date:
            meta.append(f"<b>Date:</b> {doc_date}")
        if hijri_date:
            meta.append(f"<b>Hijri:</b> {hijri_date}")
        if meta:
            row_data = [[Paragraph(m, self.S["value_normal"]) for m in meta]]
            col_w = self._usable_width() / max(len(meta), 1)
            t = Table(row_data, colWidths=[col_w] * len(meta))
            t.setStyle(TableStyle([
                ("ALIGN", (0, 0), (-1, -1), "LEFT"),
                ("VALIGN", (0, 0), (-1, -1), "MIDDLE"),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
            ]))
            s.append(t)
            s.append(Spacer(1, 3 * mm))

    # ── Key-value rows ─────────────────────────────────────────────────────────

    def add_kv_table(self, rows: list[tuple[str, str]]):
        """rows = [(label, value), ...]"""
        w = self._usable_width()
        lw = w * 0.38
        vw = w * 0.62
        data = [
            [Paragraph(lbl, self.S["label"]),
             Paragraph(val, self.S["value_normal"])]
            for lbl, val in rows
        ]
        t = Table(data, colWidths=[lw, vw])
        t.setStyle(TableStyle([
            ("VALIGN",  (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, BORDER),
        ]))
        self._story.append(t)
        self._story.append(Spacer(1, 3 * mm))

    # ── Amount line items ──────────────────────────────────────────────────────

    def add_line_items(self, items: list[tuple[str, str, float]],
                       total: float, words: bool = True):
        """items = [(description, sub-label, amount)]"""
        w = self._usable_width()
        dw = w * 0.72
        aw = w * 0.28

        data = []
        for desc, sublabel, amt in items:
            amt_str = f"PKR {int(amt):,}" if amt else "—"
            data.append([
                Paragraph(f"{desc}<br/><font size='7' color='#64748B'>{sublabel}</font>",
                          self.S["value_normal"]),
                Paragraph(amt_str, ParagraphStyle(
                    "amt", parent=self.S["value_normal"],
                    alignment=TA_RIGHT,
                )),
            ])

        t = Table(data, colWidths=[dw, aw])
        t.setStyle(TableStyle([
            ("VALIGN",  (0, 0), (-1, -1), "TOP"),
            ("TOPPADDING",    (0, 0), (-1, -1), 3),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 3),
            ("LINEBELOW", (0, 0), (-1, -2), 0.3, BORDER),
            ("ALIGN", (1, 0), (1, -1), "RIGHT"),
        ]))
        self._story.append(t)
        self._story.append(Spacer(1, 2 * mm))

        # Total bar
        self._add_total_bar(total)

        if words:
            self._story.append(Spacer(1, 2 * mm))
            self._story.append(
                Paragraph(amount_in_words(total), self.S["words"])
            )

    def _add_total_bar(self, total: float):
        w = self._usable_width()
        data = [[
            Paragraph("TOTAL AMOUNT", self.S["total_label"]),
            Paragraph(f"PKR {int(total):,}", self.S["total_value"]),
        ]]
        t = Table(data, colWidths=[w * 0.6, w * 0.4])
        t.setStyle(TableStyle([
            ("BACKGROUND",  (0, 0), (-1, -1), DARK),
            ("TOPPADDING",  (0, 0), (-1, -1), 5),
            ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
            ("LEFTPADDING", (0, 0), (0, -1), 8),
            ("RIGHTPADDING", (-1, 0), (-1, -1), 8),
            ("VALIGN",  (0, 0), (-1, -1), "MIDDLE"),
            ("ALIGN",   (1, 0), (1, -1), "RIGHT"),
        ]))
        self._story.append(t)

    # ── Signature block ────────────────────────────────────────────────────────

    def add_signature(self, signatories: int = 2):
        w = self._usable_width()
        col = w / signatories
        data = [[Paragraph(f"For {self.trust_code or self.trust_name}",
                           self.S["sig_label"])] * signatories]
        sub  = [["Authorised Signatory"] * signatories]

        self._story.append(Spacer(1, 8 * mm))
        t = Table(data, colWidths=[col] * signatories)
        t.setStyle(TableStyle([
            ("LINEABOVE", (0, 0), (-1, 0), 0.5, MID),
            ("TOPPADDING", (0, 0), (-1, -1), 4),
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        self._story.append(t)
        sub_t = Table(
            [[Paragraph(s, self.S["sig_label"]) for s in sub[0]]],
            colWidths=[col] * signatories,
        )
        sub_t.setStyle(TableStyle([
            ("ALIGN", (0, 0), (-1, -1), "CENTER"),
        ]))
        self._story.append(sub_t)

    # ── Footer ─────────────────────────────────────────────────────────────────

    def add_footer_note(self, text: str):
        self._story.append(Spacer(1, 4 * mm))
        self._story.append(HRFlowable(width="100%", thickness=0.5, color=BORDER))
        self._story.append(Spacer(1, 1 * mm))
        self._story.append(Paragraph(text, self.S["footer"]))

    # ── Build ──────────────────────────────────────────────────────────────────

    def build(self) -> BytesIO:
        self._doc.build(self._story)
        self._buf.seek(0)
        return self._buf

    def _usable_width(self) -> float:
        pw, _ = self.pagesize
        return pw - self._doc.leftMargin - self._doc.rightMargin
