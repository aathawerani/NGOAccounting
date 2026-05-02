"""
WPF Excel import — reads the exact format produced by the WPF accounting software.

Sheet layout (0-indexed Python rows / columns):
  row 0-1  : empty
  row 2    : "GENERAL LEDGER" title
  row 3    : empty
  row 4    : col[1]="NAME OF ACCOUNT :"  col[4]=account_name
  row 5    : col[1]="TYPE OF ACCOUNT:"   col[4]=account_type
  row 6    : col[1]="ACCOUNT CODE  :"    col[4]=account_code
  row 7-8  : empty / decorative
  row 9    : column headers — DATE | RECEIPT/VOUCHER NO | ACCOUNT CODE |
                              NAME OF TENANT | PARTICULARS | DEBIT | CREDIT | BALANCE
  row 10-11: empty
  row 12+  : transaction data (skip rows where col[0] DATE is empty)

Summary sheets to skip: TB, IS, BS, DEP SCH (and variants)

Double-entry semantics:
  current sheet's account_code  → LedgerEntry.account_code
  col[2] (ACCOUNT CODE column)  → LedgerEntry.contra_account_code
  col[5] DEBIT / col[6] CREDIT  → as stored
"""

from io import BytesIO
from datetime import datetime, date as date_cls
from typing import Optional
import uuid

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from database import get_db
from models.models import AccountType, LedgerEntry, Tenant, Trust

router = APIRouter(prefix="/api/import", tags=["import"])

# ── Sheet-skip list ───────────────────────────────────────────────────────────

_SKIP = {"TB", "IS", "BS", "DEP SCH", "DEP SCHEDULE", "DEP.SCH", "DEP. SCH",
         "DEPRECIATION SCHEDULE"}

# ── Column positions (0-indexed) in transaction rows ─────────────────────────

_C_DATE        = 0
_C_VOUCHER     = 1
_C_CONTRA      = 2
_C_TENANT      = 3
_C_PARTICULARS = 4
_C_DEBIT       = 5
_C_CREDIT      = 6

# ── Header-scan positions (0-indexed) ────────────────────────────────────────

_H_LABEL_COL = 1   # "NAME OF ACCOUNT :" lives in col[1]
_H_VALUE_COL = 4   # account_name / type / code live in col[4]

# Transaction data starts at this 0-indexed row (fallback if scan fails)
_DEFAULT_DATA_ROW = 12


# ── Low-level value helpers ───────────────────────────────────────────────────

def _s(v) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    return s or None


def _f(v) -> float:
    if v is None:
        return 0.0
    try:
        return float(str(v).replace(",", "").strip())
    except (ValueError, AttributeError):
        return 0.0


def _d(v, datemode: int = 0) -> Optional[date_cls]:
    """Convert any cell value to a Python date. Handles xlrd floats and strings."""
    if v is None:
        return None
    if isinstance(v, date_cls):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, float) and v > 0:
        try:
            import xlrd
            return xlrd.xldate_as_datetime(v, datemode).date()
        except Exception:
            return None
    s = str(v).strip()
    if not s:
        return None
    for fmt in ("%d-%m-%Y", "%d/%m/%Y", "%Y-%m-%d", "%m/%d/%Y",
                "%d-%b-%Y", "%d %b %Y", "%d %B %Y"):
        try:
            return datetime.strptime(s, fmt).date()
        except ValueError:
            pass
    return None


# ── Workbook reader ───────────────────────────────────────────────────────────

class _Sheet:
    def __init__(self, name: str, rows: list[list], datemode: int = 0):
        self.name = name
        self.rows = rows
        self.datemode = datemode


def _load(content: bytes, filename: str) -> list[_Sheet]:
    """Parse .xls or .xlsx into a list of _Sheet objects."""
    if filename.lower().endswith(".xls"):
        try:
            import xlrd
        except ImportError:
            raise HTTPException(500, "xlrd not installed — run: pip install xlrd")
        try:
            wb = xlrd.open_workbook(file_contents=content)
            dm = wb.datemode
            sheets = []
            for sh in wb.sheets():
                rows = []
                for r in range(sh.nrows):
                    row = []
                    for c in range(sh.ncols):
                        cell = sh.cell(r, c)
                        if cell.ctype == xlrd.XL_CELL_DATE:
                            try:
                                row.append(xlrd.xldate_as_datetime(cell.value, dm).date())
                            except Exception:
                                row.append(cell.value)
                        elif cell.ctype == xlrd.XL_CELL_EMPTY:
                            row.append(None)
                        else:
                            row.append(cell.value)
                    rows.append(row)
                sheets.append(_Sheet(sh.name, rows, dm))
            return sheets
        except HTTPException:
            raise
        except Exception as e:
            raise HTTPException(400, f"Cannot open .xls file: {e}")
    else:
        try:
            import openpyxl
            wb = openpyxl.load_workbook(BytesIO(content), data_only=True, read_only=True)
            sheets = [
                _Sheet(ws.title, [list(row) for row in ws.iter_rows(values_only=True)])
                for ws in wb.worksheets
            ]
            wb.close()
            return sheets
        except Exception as e:
            raise HTTPException(400, f"Cannot open .xlsx file: {e}")


# ── WPF sheet header parser ───────────────────────────────────────────────────

def _parse_header(rows: list[list]) -> dict:
    """Scan first 13 rows for account metadata labels."""
    meta = {"account_name": None, "account_type": None, "account_code": None}
    for row in rows[:13]:
        if not row or len(row) <= _H_VALUE_COL:
            continue
        label = str(row[_H_LABEL_COL] or "").strip().upper()
        value = _s(row[_H_VALUE_COL])
        if "NAME OF ACCOUNT" in label:
            meta["account_name"] = value
        elif "TYPE OF ACCOUNT" in label:
            meta["account_type"] = value.upper() if value else None
        elif "ACCOUNT CODE" in label:
            meta["account_code"] = value
    return meta


def _data_start(rows: list[list]) -> int:
    """Find the row index of the DATE column header, return data-start index."""
    for i, row in enumerate(rows[:16]):
        if row and str(row[0] or "").strip().upper() == "DATE":
            return i + 3   # data starts 3 rows after the header row
    return _DEFAULT_DATA_ROW


# ── Tenant detection ──────────────────────────────────────────────────────────

_SKIP_TENANT_VALUES = {"NAME OF TENANT", "TENANT", "PARTY", "NAME", ""}


def _is_rent_water(code: str) -> bool:
    """True for rent/water income sheets: R46GK7, W2BR1, RGK6, WGK6 etc."""
    if not code or len(code) < 2:
        return False
    prefix, second = code[0].upper(), code[1].upper()
    if prefix == "R" and second.isalnum() and "&" not in code:
        return True
    if prefix == "W" and second.isalnum() and code.upper() not in {"WHT", "WT"}:
        return True
    return False


def _plot_from_code(code: str) -> Optional[str]:
    """R46GK7 → 46GK7,  W2BR1 → 2BR1"""
    return code[1:] if code and len(code) > 1 else None


# ── Trust detection ───────────────────────────────────────────────────────────

_TRUST_KEYWORDS: list[tuple[set, str]] = [
    ({"THAWER", "THARIA", "HTTT"}, "HTTT"),
    ({"HUSSAINI", "VAKIL", "HVHT"}, "HVHT"),
    ({"BAIT", "BURHANI", "BIB"},   "BIB"),
]


def _extract_trust_name(sheets: list[_Sheet]) -> Optional[str]:
    """Try to read the trust name from TB / IS / BS summary sheets."""
    for sh in sheets:
        uname = sh.name.strip().upper()
        rows = sh.rows
        try:
            if uname == "TB" and len(rows) > 2:
                val = _s(rows[2][0] if rows[2] else None)
                if val:
                    return val
            elif uname == "IS" and len(rows) > 4:
                row4 = rows[4]
                val = _s(row4[1] if len(row4) > 1 else None)
                if val:
                    return val
            elif uname == "BS" and len(rows) > 0:
                row0 = rows[0]
                val = _s(row0[0] if row0 else None)
                if val:
                    return val
        except (IndexError, TypeError):
            continue
    return None


def _match_trust_keyword(detected: Optional[str], db: Session) -> Optional[dict]:
    """Keyword-match a detected name against known trust codes."""
    if not detected:
        return None
    upper = detected.upper()
    for keywords, code in _TRUST_KEYWORDS:
        if any(kw in upper for kw in keywords):
            trust = db.query(Trust).filter(Trust.code == code).first()
            if trust:
                return {"id": trust.id, "code": trust.code, "name": trust.name}
    return None


# ── Transaction parser ────────────────────────────────────────────────────────

def _parse_transactions(sheet: _Sheet, account_code: str) -> tuple[list[dict], list[str]]:
    """Return (transactions, unique_tenant_names)."""
    rows = sheet.rows
    start = _data_start(rows)
    txns: list[dict] = []
    tenant_names: list[str] = []
    is_rt = _is_rent_water(account_code)

    for row in rows[start:]:
        if not row:
            continue
        # Skip blank rows
        if all(v is None or str(v).strip() == "" for v in row):
            continue
        dt = _d(row[_C_DATE] if len(row) > _C_DATE else None, sheet.datemode)
        if dt is None:
            continue   # not a valid transaction row

        tenant = _s(row[_C_TENANT] if len(row) > _C_TENANT else None)
        if is_rt and tenant and tenant.upper() not in _SKIP_TENANT_VALUES:
            tenant_names.append(tenant)

        txns.append({
            "date":                dt,
            "receipt_no":          _s(row[_C_VOUCHER]     if len(row) > _C_VOUCHER     else None),
            "contra_account_code": _s(row[_C_CONTRA]      if len(row) > _C_CONTRA      else None),
            "party_name":          tenant,
            "particulars":         _s(row[_C_PARTICULARS] if len(row) > _C_PARTICULARS else None),
            "debit":               _f(row[_C_DEBIT]       if len(row) > _C_DEBIT       else 0),
            "credit":              _f(row[_C_CREDIT]      if len(row) > _C_CREDIT      else 0),
        })

    return txns, list(dict.fromkeys(tenant_names))   # preserve order, dedupe


# ── Endpoints ─────────────────────────────────────────────────────────────────

@router.post("/detect-trust")
async def detect_trust(
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Read the file, extract trust name from summary sheets, return keyword match."""
    if not file.filename.lower().endswith((".xls", ".xlsx")):
        raise HTTPException(400, "Only .xls and .xlsx files are supported")
    content = await file.read()
    sheets = _load(content, file.filename)
    detected_name = _extract_trust_name(sheets)
    matched = _match_trust_keyword(detected_name, db)
    all_trusts = db.query(Trust).order_by(Trust.code).all()
    return {
        "detected_name":     detected_name,
        "matched_trust_id":   matched["id"]   if matched else None,
        "matched_trust_code": matched["code"] if matched else None,
        "matched_trust_name": matched["name"] if matched else None,
        "confidence":         "high" if matched else "none",
        "all_trusts": [{"id": t.id, "code": t.code, "name": t.name} for t in all_trusts],
    }


@router.post("/preview")
async def preview(trust_id: int = Form(...), file: UploadFile = File(...)):
    if not file.filename.lower().endswith((".xls", ".xlsx")):
        raise HTTPException(400, "Only .xls and .xlsx files are supported")

    content = await file.read()
    sheets = _load(content, file.filename)

    skipped: list[str] = []
    accounts: list[dict] = []
    all_tenants: list[dict] = []
    total_txns = 0

    for sh in sheets:
        if sh.name.strip().upper() in _SKIP:
            skipped.append(sh.name)
            continue

        meta = _parse_header(sh.rows)
        code = meta["account_code"] or sh.name.strip()
        txns, tenants = _parse_transactions(sh, code)
        total_txns += len(txns)

        if tenants:
            plot = _plot_from_code(code)
            for t in tenants:
                all_tenants.append({"name": t, "plot_code": plot})

        accounts.append({
            "sheet":             sh.name,
            "account_code":      code,
            "account_name":      meta["account_name"] or code,
            "account_type":      meta["account_type"] or "UNKNOWN",
            "transaction_count": len(txns),
        })

    # Dedupe tenants by name
    seen: dict[str, dict] = {}
    for t in all_tenants:
        seen.setdefault(t["name"], t)

    return {
        "total_sheets":       len(sheets),
        "sheets_skipped":     skipped,
        "accounts_found":     len(accounts),
        "transactions_found": total_txns,
        "tenants_found":      len(seen),
        "accounts":           accounts,
        "tenants":            list(seen.values()),
        "warnings":           [],
    }


@router.post("/execute")
async def execute_import(
    trust_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    if not db.query(Trust).filter(Trust.id == trust_id).first():
        raise HTTPException(404, "Trust not found")

    if not file.filename.lower().endswith((".xls", ".xlsx")):
        raise HTTPException(400, "Only .xls and .xlsx files are supported")

    content = await file.read()
    sheets = _load(content, file.filename)

    accounts_created = 0
    accounts_updated = 0
    transactions_imported = 0
    tenants_upserted = 0
    errors: list[str] = []
    log: list[dict] = []

    for sh in sheets:
        if sh.name.strip().upper() in _SKIP:
            log.append({"type": "skip", "sheet": sh.name})
            continue

        meta = _parse_header(sh.rows)
        code  = meta["account_code"] or sh.name.strip()
        name  = meta["account_name"] or code
        atype = meta["account_type"] or "ASSET"

        # ── Upsert account type ──────────────────────────────────────────────
        try:
            existing = (
                db.query(AccountType)
                .filter(AccountType.trust_id == trust_id, AccountType.account_code == code)
                .first()
            )
            if existing:
                existing.account_name = name
                existing.account_type = atype
                accounts_updated += 1
            else:
                db.add(AccountType(
                    trust_id=trust_id,
                    account_code=code,
                    account_name=name,
                    account_type=atype,
                    is_certificate=code in {"SSC", "DSC", "BEH", "BSC"},
                ))
                accounts_created += 1
            db.flush()
        except Exception as e:
            db.rollback()
            errors.append(f"Account {code}: {e}")
            continue

        # ── Import transactions ──────────────────────────────────────────────
        txns, tenants = _parse_transactions(sh, code)
        imported = 0

        for txn in txns:
            try:
                db.add(LedgerEntry(
                    trust_id=trust_id,
                    account_code=code,
                    date=txn["date"],
                    receipt_no=txn["receipt_no"],
                    party_name=txn["party_name"],
                    contra_account_code=txn["contra_account_code"],
                    particulars=txn["particulars"],
                    debit=txn["debit"],
                    credit=txn["credit"],
                    row_order=2,
                    account_key=str(uuid.uuid4())[:8],
                ))
                imported += 1
            except Exception as e:
                errors.append(f"Sheet {sh.name} txn {txn.get('date')}: {e}")

        transactions_imported += imported

        # ── Upsert tenants ───────────────────────────────────────────────────
        if tenants:
            plot = _plot_from_code(code)
            for tname in tenants:
                exists = (
                    db.query(Tenant)
                    .filter(Tenant.trust_id == trust_id, Tenant.name == tname)
                    .first()
                )
                if not exists:
                    db.add(Tenant(
                        trust_id=trust_id,
                        name=tname,
                        plot_code=plot,
                        space_type="SHOP",
                        monthly_rent=0.0,
                        water_charge=0.0,
                        is_active=True,
                    ))
                    tenants_upserted += 1

        try:
            db.commit()
        except Exception as e:
            db.rollback()
            errors.append(f"Commit failed for sheet {sh.name}: {e}")
            continue

        log.append({
            "type":         "account",
            "sheet":        sh.name,
            "account_code": code,
            "account_name": name,
            "account_type": atype,
            "transactions": imported,
            "tenants":      len(tenants),
        })

    # ── Post-extract tenants from primary account entries with R/W contra codes ─
    # WPF records rent/water receipts only in CASH/BANK sheets; the income account
    # sheets (R46GK7, W2BR1 …) are structurally present but contain no transaction
    # rows. Tenant names appear in the party_name column of those CASH entries
    # whose contra_account_code matches an R/W pattern.
    try:
        all_entries_with_party = (
            db.query(LedgerEntry)
            .filter(
                LedgerEntry.trust_id == trust_id,
                LedgerEntry.party_name != None,
                LedgerEntry.party_name != "",
            )
            .all()
        )
        seen_names: set = set()
        for e in all_entries_with_party:
            if not _is_rent_water(e.contra_account_code or ""):
                continue
            tname = (e.party_name or "").strip()
            if not tname or tname.upper() in _SKIP_TENANT_VALUES or tname in seen_names:
                continue
            seen_names.add(tname)
            exists = (
                db.query(Tenant)
                .filter(Tenant.trust_id == trust_id, Tenant.name == tname)
                .first()
            )
            if not exists:
                db.add(Tenant(
                    trust_id=trust_id,
                    name=tname,
                    plot_code=_plot_from_code(e.contra_account_code),
                    space_type="SHOP",
                    monthly_rent=0.0,
                    water_charge=0.0,
                    is_active=True,
                ))
                tenants_upserted += 1
        db.commit()
    except Exception as e:
        db.rollback()
        errors.append(f"Tenant post-extraction failed: {e}")

    return {
        "accounts_created":      accounts_created,
        "accounts_updated":      accounts_updated,
        "transactions_imported": transactions_imported,
        "tenants_upserted":      tenants_upserted,
        "errors":                errors,
        "log":                   log,
    }
