from contextlib import asynccontextmanager
from datetime import date
import hashlib
import os
import sqlite3

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database import engine, SessionLocal
from models.models import Base, Trust, Plot, AccountType, LedgerEntry, FiscalYearClose
from routers import tenants as tenants_router
from routers import plots as plots_router
from routers import rent as rent_router
from routers import majlis as majlis_router
from routers import investments as investments_router
from routers import vouchers as vouchers_router
from routers import receivables as receivables_router
from routers import accounts as accounts_router
from routers import import_data as import_router
from routers import export_data as export_router
from routers import dashboard as dashboard_router
from routers import reports as reports_router
from routers import backup as backup_router
from routers import fiscal_year as fiscal_year_router
from routers import search as search_router
from routers import audit_log as audit_log_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    _run_migrations()       # add new columns before create_all
    Base.metadata.create_all(bind=engine)
    _seed_trusts()
    _seed_plots()
    _seed_account_types()
    _backfill_import_hashes()
    yield


app = FastAPI(title="NGO Accounting API", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(tenants_router.router)
app.include_router(plots_router.router)
app.include_router(rent_router.router)
app.include_router(majlis_router.router)
app.include_router(investments_router.router)
app.include_router(vouchers_router.router)
app.include_router(receivables_router.router)
app.include_router(accounts_router.router)
app.include_router(import_router.router)
app.include_router(export_router.router)
app.include_router(dashboard_router.router)
app.include_router(reports_router.router)
app.include_router(backup_router.router)
app.include_router(fiscal_year_router.router)
app.include_router(search_router.router)
app.include_router(audit_log_router.router)


# ── Migrations ───────────────────────────────────────────────────────────────

def _run_migrations():
    """Add new columns to existing DB without losing data."""
    db_path = "./ngo_accounting.db"
    if not os.path.exists(db_path):
        return  # fresh DB — create_all handles schema
    conn = sqlite3.connect(db_path)
    cursor = conn.cursor()
    try:
        cursor.execute("PRAGMA table_info(ledger_entries)")
        existing = {row[1] for row in cursor.fetchall()}
        stmts = []
        if "import_hash" not in existing:
            stmts.append("ALTER TABLE ledger_entries ADD COLUMN import_hash TEXT")
        if "is_deleted" not in existing:
            stmts.append("ALTER TABLE ledger_entries ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0")
        if "validation_warnings" not in existing:
            stmts.append("ALTER TABLE ledger_entries ADD COLUMN validation_warnings TEXT")
        for s in stmts:
            cursor.execute(s)
        if stmts:
            conn.commit()
            print(f"DB migration: applied {len(stmts)} column addition(s) to ledger_entries")

        # vouchers table migrations
        cursor.execute("PRAGMA table_info(vouchers)")
        v_existing = {row[1] for row in cursor.fetchall()}
        v_stmts = []
        if "voucher_type" not in v_existing:
            v_stmts.append("ALTER TABLE vouchers ADD COLUMN voucher_type TEXT DEFAULT 'Payment'")
        if "account_code" not in v_existing:
            v_stmts.append("ALTER TABLE vouchers ADD COLUMN account_code TEXT")
        if "contra_account_code" not in v_existing:
            v_stmts.append("ALTER TABLE vouchers ADD COLUMN contra_account_code TEXT DEFAULT 'CASH'")
        for s in v_stmts:
            cursor.execute(s)
        if v_stmts:
            conn.commit()
            print(f"DB migration: applied {len(v_stmts)} column addition(s) to vouchers")
    finally:
        conn.close()


def _backfill_import_hashes():
    """Compute import_hash for existing entries that were imported before v2."""
    db = SessionLocal()
    try:
        entries = db.query(LedgerEntry).filter(LedgerEntry.import_hash == None).all()
        if not entries:
            return
        for e in entries:
            raw = f"{e.trust_id}|{e.account_code}|{(e.particulars or '')[:50]}"
            e.import_hash = hashlib.md5(raw.encode("utf-8")).hexdigest()
        db.commit()
        print(f"DB backfill: computed import_hash for {len(entries)} existing entries")
    finally:
        db.close()


# ── Seeding ───────────────────────────────────────────────────────────────────

def _seed_trusts():
    db = SessionLocal()
    try:
        if db.query(Trust).count() == 0:
            db.add_all([
                Trust(
                    name="Hussaini Vakil Hussain Trust",
                    code="HVHT",
                    description="Main trust for Hussaini properties",
                ),
                Trust(
                    name="Bait-ul-Ilm Burhani",
                    code="BIB",
                    description="Educational trust",
                ),
                Trust(
                    name="Husami Tahir Taheri Trust",
                    code="HTTT",
                    description="Charitable trust",
                ),
            ])
            db.commit()
    finally:
        db.close()


def _seed_plots():
    """Seed WPF-matching property plots per trust."""
    db = SessionLocal()
    try:
        if db.query(Plot).count() == 0:
            trusts = {t.code: t.id for t in db.query(Trust).all()}
            plots = []
            if "HVHT" in trusts:
                plots.append(Plot(trust_id=trusts["HVHT"], code="GK6/1"))
            if "HTTT" in trusts:
                plots += [
                    Plot(trust_id=trusts["HTTT"], code="46GK7"),
                    Plot(trust_id=trusts["HTTT"], code="2BR1"),
                    Plot(trust_id=trusts["HTTT"], code="4BR1"),
                    Plot(trust_id=trusts["HTTT"], code="21BR1"),
                ]
            if "BIB" in trusts:
                plots.append(Plot(trust_id=trusts["BIB"], code="MAIN"))
            if plots:
                db.add_all(plots)
                db.commit()
    finally:
        db.close()


def _seed_account_types():
    """Seed WPF-matching account codes per trust."""
    db = SessionLocal()
    try:
        if db.query(AccountType).count() > 0:
            return
        trusts = {t.code: t.id for t in db.query(Trust).all()}

        def _accts(trust_code, rows):
            tid = trusts.get(trust_code)
            if not tid:
                return []
            return [AccountType(trust_id=tid, account_code=c, account_name=n,
                                account_type=t, is_certificate=cert)
                    for c, n, t, cert in rows]

        hvht = _accts("HVHT", [
            ("CASH",    "Cash in Hand",                  "ASSET",   False),
            ("LGK6/1",  "Land GK6/1",                   "ASSET",   False),
            ("BGK6/1",  "Building GK6/1",                "ASSET",   False),
            ("DGK6/1",  "Accumulated Depreciation GK6/1","ASSET",   False),
            ("RGK6",    "Rent Income GK6",               "INCOME",  False),
            ("WGK6",    "Water Charges GK6",             "INCOME",  False),
            ("SSC",     "SSC Certificates",              "ASSET",   True),
            ("DSC",     "DSC Certificates",              "ASSET",   True),
            ("WHT",     "Withholding Tax",               "EXPENSE", False),
            ("PTGK6",   "Property Tax GK6",              "EXPENSE", False),
            ("WTGK6",   "Water Tax GK6",                 "EXPENSE", False),
            ("RRPM",    "Repair & Maintenance",          "EXPENSE", False),
            ("AUD1",    "Audit Fees 1",                  "EXPENSE", False),
            ("AUD2",    "Audit Fees 2",                  "EXPENSE", False),
            ("KHC",     "Khums / Chanda",                "INCOME",  False),
            ("IRC",     "IRC Income",                    "INCOME",  False),
            ("DOT",     "Donations",                     "INCOME",  False),
            ("PROFIT",  "Profit on Investments",         "INCOME",  False),
            ("GF",      "General Fund",                  "EQUITY",  False),
            ("LEGAL",   "Legal Expenses",                "EXPENSE", False),
            ("FUND",    "Trust Fund",                    "EQUITY",  False),
        ])

        httt = _accts("HTTT", [
            ("CASH",    "Cash in Hand",          "ASSET",   False),
            ("BANK",    "Bank Account",          "ASSET",   False),
            ("R46GK7",  "Rent 46GK7",            "INCOME",  False),
            ("R2BR1",   "Rent 2BR1",             "INCOME",  False),
            ("R4BR1",   "Rent 4BR1",             "INCOME",  False),
            ("R21BR1",  "Rent 21BR1",            "INCOME",  False),
            ("W46GK7",  "Water Charges 46GK7",   "INCOME",  False),
            ("W2BR1",   "Water Charges 2BR1",    "INCOME",  False),
            ("W4BR1",   "Water Charges 4BR1",    "INCOME",  False),
            ("W21BR1",  "Water Charges 21BR1",   "INCOME",  False),
            ("B46GK7",  "Building 46GK7",        "ASSET",   False),
            ("B2BR1",   "Building 2BR1",         "ASSET",   False),
            ("B4BR1",   "Building 4BR1",         "ASSET",   False),
            ("B21BR1",  "Building 21BR1",        "ASSET",   False),
            ("PT46GK7", "Property Tax 46GK7",    "EXPENSE", False),
            ("PT2BR1",  "Property Tax 2BR1",     "EXPENSE", False),
            ("PT4BR1",  "Property Tax 4BR1",     "EXPENSE", False),
            ("PT21BR1", "Property Tax 21BR1",    "EXPENSE", False),
            ("WT46GK7", "Water Tax 46GK7",       "EXPENSE", False),
            ("WT2BR1",  "Water Tax 2BR1",        "EXPENSE", False),
            ("WT4BR1",  "Water Tax 4BR1",        "EXPENSE", False),
            ("WT21BR1", "Water Tax 21BR1",       "EXPENSE", False),
            ("GF",      "General Fund",          "EQUITY",  False),
            ("DEP",     "Depreciation",          "EXPENSE", False),
            ("SSC",     "SSC Certificates",      "ASSET",   True),
            ("DSC",     "DSC Certificates",      "ASSET",   True),
            ("WHT",     "Withholding Tax",       "EXPENSE", False),
            ("M&S",     "Management & Services", "EXPENSE", False),
            ("LEGAL",   "Legal Expenses",        "EXPENSE", False),
            ("AUD1",    "Audit Fees 1",          "EXPENSE", False),
            ("AUD2",    "Audit Fees 2",          "EXPENSE", False),
            ("PROFIT",  "Profit on Investments", "INCOME",  False),
        ])

        bib = _accts("BIB", [
            ("CASH",    "Cash in Hand",                "ASSET",   False),
            ("BANK",    "Bank Account",                "ASSET",   False),
            ("GF",      "General Fund",                "EQUITY",  False),
            ("DOT1",    "Donations 1",                 "INCOME",  False),
            ("DOT2",    "Donations 2",                 "INCOME",  False),
            ("BOX",     "Collection Box",              "ASSET",   False),
            ("CAP-DOT", "Capital Donations",           "INCOME",  False),
            ("M-SUB",   "Majlis Subscription",         "INCOME",  False),
            ("M-EXP",   "Majlis Expenses",             "EXPENSE", False),
            ("RENT",    "Rent Income",                 "INCOME",  False),
            ("WSC",     "Water Service Charges",       "INCOME",  False),
            ("LOUD",    "Loud Speaker (Asset)",        "ASSET",   False),
            ("L-CHGS",  "Loud Speaker Charges",        "EXPENSE", False),
            ("R&M",     "Repair & Maintenance",        "EXPENSE", False),
            ("INS",     "Insurance",                   "EXPENSE", False),
            ("SW",      "Sweeper",                     "EXPENSE", False),
            ("KESC",    "Electricity (KESC)",          "EXPENSE", False),
            ("SSGC",    "Gas (SSGC)",                  "EXPENSE", False),
            ("MISC",    "Miscellaneous",               "EXPENSE", False),
            ("LEGAL",   "Legal Expenses",              "EXPENSE", False),
            ("BLDG",    "Building",                    "ASSET",   False),
            ("F&F",     "Furniture & Fixtures",        "ASSET",   False),
            ("L-INST",  "Library Installations",       "ASSET",   False),
            ("E-INST",  "Electrical Installations",    "ASSET",   False),
            ("W-COOL",  "Water Cooler",                "ASSET",   False),
            ("LAND",    "Land",                        "ASSET",   False),
            ("DEP",     "Depreciation",                "EXPENSE", False),
            ("SSC",     "SSC Certificates",            "ASSET",   True),
            ("DSC",     "DSC Certificates",            "ASSET",   True),
            ("BEH",     "BEH Certificates",            "ASSET",   True),
            ("PROFIT",  "Profit on Investments",       "INCOME",  False),
            ("AUD2",    "Audit Fees",                  "EXPENSE", False),
            ("WT",      "WHT on Certificates",         "EXPENSE", False),
            ("WHT",     "Withholding Tax",             "EXPENSE", False),
        ])

        db.add_all(hvht + httt + bib)
        db.commit()
    finally:
        db.close()


# ── Misc endpoints ────────────────────────────────────────────────────────────

@app.get("/")
def root():
    return {"message": "NGO Accounting API", "status": "running"}


@app.get("/api/trusts")
def get_trusts():
    db = SessionLocal()
    try:
        return [
            {"id": t.id, "name": t.name, "code": t.code, "description": t.description}
            for t in db.query(Trust).all()
        ]
    finally:
        db.close()


@app.get("/api/current-date")
def get_current_date():
    today = date.today()
    hijri_str = None
    hijri_formatted = None
    try:
        from hijri_converter import convert
        h = convert.Gregorian(today.year, today.month, today.day).to_hijri()
        hijri_str = f"{h.year}/{h.month:02d}/{h.day:02d}"
        hijri_formatted = f"{h.day} {h.month_name()} {h.year} AH"
    except Exception:
        pass
    return {
        "gregorian": today.isoformat(),
        "gregorian_formatted": today.strftime("%d %B %Y"),
        "hijri": hijri_str,
        "hijri_formatted": hijri_formatted,
    }
