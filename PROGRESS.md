# NGO Accounting — Progress Tracker

## Stack
- **Backend**: Python FastAPI · SQLite via SQLAlchemy · port 8000
- **Frontend**: React + Vite + Tailwind CSS · port 5173
- **DB file**: `backend/ngo_accounting.db`

---

## Feature Status

### Data / Infrastructure
| Feature | Status | Notes |
|---|---|---|
| Trust seeding (HVHT / BIB / HTTT) | ✅ Done | Seeded on startup via `_seed_trusts()` |
| Plot seeding | ✅ Done | GK6/1 / MAIN / 46GK7 2BR1 4BR1 21BR1 |
| Account type seeding | ✅ Done | 21 HVHT · 34 BIB · 31 HTTT (+ imported extras) |
| SQLite migrations (add columns) | ✅ Done | `_run_migrations()` adds import_hash / is_deleted / validation_warnings without data loss |

### Import (ImportExcelPage)
| Feature | Status | Notes |
|---|---|---|
| Drag-and-drop .xls / .xlsx upload | ✅ Done | |
| Auto trust detection from file | ✅ Done | Reads TB / IS / BS sheets for trust name |
| Manual trust override | ✅ Done | |
| Preview (sync analysis) | ✅ Done | Estimates inserts / updates / flags per account |
| Smart-sync upsert logic | ✅ Done | MD5(trust_id\|account_code\|particulars[:50]) |
| insert / update / flag / restore | ✅ Done | |
| Tenant extraction & upsert after import | ✅ Done | From R/W contra accounts |
| Date validation warnings | ✅ Done | future_date / date_too_old / voucher_spread |
| View Warnings modal | ✅ Done | |
| Per-account colour-coded sync log | ✅ Done | green=new blue=updated amber=flagged |
| HTTT 2025 data imported | ✅ Done | 413 entries · 45 accounts · 32 tenants |
| HVHT data imported | ⬜ Pending | No data yet |
| BIB data imported | ⬜ Pending | No data yet |

### Rent Entry (RentEntryPage)
| Feature | Status | Notes |
|---|---|---|
| Tenant dropdown (from tenants table) | ✅ Done | Filtered by selectedTrust |
| Imported ledger receipts (property/tenant grouped) | ✅ Done | From ledger_entries via `/api/rent/ledger-receipts` |
| Rent / Water tab toggle | ✅ Done | |
| Expandable tenant rows with receipt detail | ✅ Done | |
| New receipt form (RentReceipt model) | ✅ Done | Creates RentReceipt with WPF-format particulars |
| Double-entry ledger entries for new receipts | ✅ Done | Creates CASH/BANK DR + R-account CR + W-account CR rows |
| Cash/Bank account selector on form | ✅ Done | Dropdown populated from `/api/rent/cash-accounts` |
| Edit receipt | ✅ Done | |
| Delete receipt | ✅ Done | |
| Last paid tracking | ✅ Done | Updates tenant.last_paid_month/year |
| Cash received tracking (TASK-030) | ✅ Done | cash_received + cash_status (PAID/SHORT/ADVANCE); form input + "No cash received" checkbox; history table: Cash Recv + Balance columns; DB migration with backfill |

### Cash Position (CashPositionPage)
| Feature | Status | Notes |
|---|---|---|
| Balance cards per CASH/BANK account | ✅ Done | Reads from ledger_entries via accounts API |
| Total liquid assets card | ✅ Done | |
| Recent transactions table | ✅ Done | Last 25, sorted by date desc |
| Running balance per row | ✅ Done | |
| Physical Cash / Receivables / On-Account / Book Income cards (TASK-034) | ✅ Done | New `/api/cash-position` endpoint; source breakdown table; all-trusts side-by-side panel |

### Journal Entries (JournalEntriesPage)
| Feature | Status | Notes |
|---|---|---|
| Account ledger view (per account) | ✅ Done | With running balance |
| All transactions view | ✅ Done | DR/CR pairs, 200 limit, filterable |
| New journal entry form | ✅ Done | Posts two LedgerEntry rows |
| Delete journal entry | ✅ Done | Deletes both legs by account_key |
| is_deleted filter in ledger query | ✅ Fixed | `accounts.py` now filters `is_deleted==False` |

### Investments (InvestmentsPage)
| Feature | Status | Notes |
|---|---|---|
| Certificate ledger balances (SSC/DSC/BEH/TERM) | ✅ Done | From account ledger |
| Certificate table with ACTIVE/MATURED filter | ✅ Done | |
| Purchase certificate form | ✅ Done | |
| Record profit form | ✅ Done | |
| Mark as matured/sold | ✅ Done | |
| Delete certificate | ✅ Done | |

### Export (ExportReportsPage)
| Feature | Status | Notes |
|---|---|---|
| Summary reports (TB / GL / IS / BS) | ✅ Done | `/api/export/reports` |
| WPF-format ledger export (per account sheets) | ✅ Done | `/api/export/ledger` |
| WPF full workbook (exact round-trip) | ✅ Done | `/api/export/full` |
| Fiscal year filter | ✅ Done | |
| Date range presets | ✅ Done | |
| Re-import verification (round-trip test) | ✅ Done | 413 txns / 0 inserts / 0 flags — lossless |
| Export Receivables to Excel | ✅ Done | `/api/export/receivables?trust_id=X&status=Pending` |

### Tenants (TenantsPage)
| Feature | Status | Notes |
|---|---|---|
| Full CRUD | ✅ Done | |
| Plot/space/CNIC/last paid | ✅ Done | |

### Majlis Bills (MajlisBillsPage)
| Feature | Status | Notes |
|---|---|---|
| Majlis bill form (28 WPF fields) | ✅ Done | Date, hijri date, event, time, beverages, spices, services |
| Summary stat cards | ✅ Done | Total bills, M-SUB received, L-CHGS received, grand total |
| Debit account dropdown | ✅ Done | Populated from `/api/rent/cash-accounts` |
| Journal preview in form | ✅ Done | Shows DR/CR breakdown before saving |
| Double-entry on create | ✅ Done | CASH DR total; M-SUB CR (bill−LS); L-CHGS CR loud_speaker |
| Edit bill | ✅ Done | Pencil button pre-fills form; PUT /api/majlis/{id} re-issues journal entries |
| Delete bill | ✅ Done | Also removes associated journal entries (majl-/lchg- keys) |
| Backend PUT endpoint | ✅ Done | `/api/majlis/{id}` update with recalculated totals |
| Cash received tracking (TASK-031) | ✅ Done | cash_received + cash_status (PAID/SHORT/ADVANCE); form input + "No cash received" checkbox; history table shows Cash Recv + Balance columns; DB migration with backfill |

### Dashboard (DashboardPage) — NEW
| Feature | Status | Notes |
|---|---|---|
| Summary stat cards | ✅ Done | Cash total, investments, receivables, journal link |
| Cash account breakdown | ✅ Done | Per-account balance list |
| Recent 10 transactions | ✅ Done | DR legs, sorted by date |
| Quick action buttons | ✅ Done | Rent Entry, Journal, Import, Export |
| `/api/dashboard/summary` endpoint | ✅ Done | Single call for all dashboard data |

### Vouchers (VouchersPage)
| Feature | Status | Notes |
|---|---|---|
| Payment / Receipt tabs | ✅ Done | Tab toggle, separate DR/CR logic |
| Account selector from DB | ✅ Done | Filters EXPENSE (Payment) or INCOME (Receipt) |
| Contra account (CASH/BANK) selector | ✅ Done | From `/api/rent/cash-accounts` |
| Double-entry journal on create | ✅ Done | `vouc-{id}` key; DR/CR per voucher type |
| Edit voucher | ✅ Done | Pencil button; PUT endpoint refreshes journal entries |
| Delete voucher | ✅ Done | Removes journal entries first |
| Stat cards | ✅ Done | Payment count/total, Receipt count/total |
| Backend PUT endpoint | ✅ Done | `/api/vouchers/{id}` |
| `voucher_type`, `account_code`, `contra_account_code` columns | ✅ Done | Added via migration |

### Receivables (ReceivablesPage)
| Feature | Status | Notes |
|---|---|---|
| Rent Arrears tab | ✅ Done | Tenant-based, colour coded green/amber/red by months behind |
| Filter by space type / plot | ✅ Done | SHOP/FLAT dropdown + plot dropdown |
| General Receivables tab | ✅ Done | Add form + table, mark received, delete |
| Stat cards | ✅ Done | Overdue tenants, est. outstanding, pending receivables |
| Export to Excel button | ✅ Done | Downloads pending receivables via `/api/export/receivables` |

### Financial Reports (ReportsPage) — NEW
| Feature | Status | Notes |
|---|---|---|
| Trial Balance tab | ✅ Done | All accounts, DR/CR/balance, CSV download |
| Income Statement tab | ✅ Done | INCOME vs EXPENSE, net surplus/deficit |
| Balance Sheet tab | ✅ Done | Two-column ASSETS vs LIAB+EQUITY, net profit row, balance check alert |
| Monthly Cash tab (TASK-037) | ✅ Done | 9-column table: Rent/Majlis Billed/Collected/Outstanding + Total Cash In + Cumulative; Export Excel |
| Fiscal year filter | ✅ Done | Year dropdown (2020–current) or "All Periods" |
| Backend endpoints | ✅ Done | `/api/reports/trial-balance`, `/api/reports/income-statement`, `/api/reports/balance-sheet` |
| PDF export | ✅ Done | POST `/api/reports/pdf` — A4 reportlab PDF, opens inline in new tab |
| Daily Summary (TASK-039) | ✅ Done | `GET /api/reports/daily-summary` + PDF; Dashboard "End of Day" modal |

### PDF Printing (TASK-020)
| Feature | Status | Notes |
|---|---|---|
| Shared `pdf_utils.py` | ✅ Done | NGODoc class, `amount_in_words`, `hijri_str` |
| Voucher PDF | ✅ Done | GET `/api/vouchers/{id}/pdf` — A5 with letterhead, accounts, amount in words |
| Rent Receipt PDF | ✅ Done | GET `/api/rent/receipt/{id}/pdf` — A5 with tenant details, rent/water lines |
| Frontend print buttons | ✅ Done | VouchersPage + RentEntryPage — printer icon opens inline in new tab |

### Tenant Statement (TASK-022)
| Feature | Status | Notes |
|---|---|---|
| `GET /api/tenants/{id}/statement` | ✅ Done | Month-by-month rows with running arrears |
| `GET /api/tenants/{id}/statement/pdf` | ✅ Done | A4 inline PDF with receipt table |
| Statement modal in TenantsPage | ✅ Done | FileText icon per row → wide modal with year picker, summary strip, table, Print PDF button |

### Investment Maturity Alerts (TASK-023)
| Feature | Status | Notes |
|---|---|---|
| `GET /api/investments/maturing` | ✅ Done | Returns ACTIVE certs maturing within N days, with urgency=red/orange/yellow |
| Dashboard alert widget | ✅ Done | Shows amber banner with list of maturing certs; color-coded days remaining |

### Audit Log (TASK-024)
| Feature | Status | Notes |
|---|---|---|
| `AuditLog` model | ✅ Done | audit_logs table — trust_id, table, record_id, action, description, timestamp |
| `audit.py` helper | ✅ Done | `log_audit(db, ...)` called after each create/update/delete |
| `GET /api/audit-log` | ✅ Done | Filterable by trust/table/action, paginated |
| Audit hooks | ✅ Done | vouchers, rent_receipts, tenants, investments — create/update/delete all logged |
| AuditLogPage | ✅ Done | Table with timestamp/action/table/description; filters + client-side search; pagination |
| Sidebar entry | ✅ Done | Under "Settings" section |

---

### App Launcher & Packaging
| Feature | Status | Notes |
|---|---|---|
| `launch.py` tray launcher | ✅ Done | pystray + Pillow; starts FastAPI + Vite, opens browser, system tray icon |
| Desktop shortcut | ✅ Done | `create_shortcut.ps1` → `NGO Accounting.lnk` on Desktop |
| `NGO Accounting.vbs` | ✅ Done | Silent launcher (no console window) via WScript |

### Backup System
| Feature | Status | Notes |
|---|---|---|
| `POST /api/backup/create` | ✅ Done | DB snapshot + Excel workbooks per trust → `backend/Backups/` |
| `GET /api/backup/last` | ✅ Done | Returns last backup timestamp |
| Dashboard backup button | ✅ Done | "Backup Now" button + last backup date display |

### Fiscal Year Closing
| Feature | Status | Notes |
|---|---|---|
| `FiscalYearClose` model | ✅ Done | Added to `models.py` |
| `GET /api/fiscal-year/preview` | ✅ Done | Shows income/expense/surplus + balance accounts |
| `POST /api/fiscal-year/close` | ✅ Done | Books surplus to GF, creates opening balance entries |
| `GET /api/fiscal-year/closed-years` | ✅ Done | Lists all closed FYs per trust |
| `FiscalYearClosePage.jsx` | ✅ Done | Year selector, preview table, confirm dialog, closed years list |

### Global Search
| Feature | Status | Notes |
|---|---|---|
| `GET /api/search?trust_id=X&q=Y` | ✅ Done | Searches particulars, party_name, receipt_no, account_code, amounts |
| Search bar in TopBar | ✅ Done | Debounced 300ms, dropdown with 20 results, DR/CR amounts shown |

### UI Polish
| Feature | Status | Notes |
|---|---|---|
| Shared `ui.jsx` components | ✅ Done | Skeleton, SkeletonTable, EmptyState, StatCard, PageHeader, Badge, Btn |
| Stat card loading skeletons | ✅ Done | VouchersPage, MajlisBillsPage, ReceivablesPage now show skeleton cards while loading |
| `ArrowPathRoundedSquare` import fix | ✅ Fixed | ImportExcelPage replaced with `RotateCcw` — build was broken |

---

## Known Bugs / Issues

1. ~~**Ledger endpoint returns is_deleted entries**~~ **FIXED 2026-05-09** — `accounts.py` `get_ledger` now filters `is_deleted=False`.

2. ~~**No double-entry for new rent receipts**~~ **FIXED 2026-05-09** — `rent.py` `create_receipt` now also creates `LedgerEntry` rows (CASH/BANK DR, R-account and W-account CR). `update_receipt` deletes old and recreates. `delete_receipt` also removes associated journal entries.

3. **HVHT and BIB have no ledger data**: Only HTTT has been imported. Other trusts show empty pages.

4. ~~**GF classified as CAPITAL not EQUITY**~~ **FIXED** — `export_data.py` `_build_balance_sheet` and `/api/reports/balance-sheet` now include both `EQUITY` and `CAPITAL` account types in equity section.

5. ~~**Tenant rent/water amounts are 0 after import**~~ **FIXED** — `POST /api/tenants/backfill-rates` mines `RENT @N` / `WATER @N` patterns from ledger; "Fix Rates" button on TenantsPage calls it.

6. ~~**`ArrowPathRoundedSquare` missing from lucide-react**~~ **FIXED 2026-05-16** — Replaced with `RotateCcw` in ImportExcelPage; frontend build now passes cleanly.

---

## Session History

### Session 2026-05-09 — Completed

**Backend changes:**
- `accounts.py`: Added `is_deleted==False` filter to `get_ledger` endpoint — fixes cash position and journal showing flagged entries
- `rent.py`: Added `debit_account_code` field to `RentReceiptBody`
- `rent.py`: Added helpers `_rent_water_accounts`, `_create_journal_entries`, `_delete_journal_entries`
- `rent.py`: `create_receipt` now creates double-entry ledger rows after saving receipt
- `rent.py`: `update_receipt` now refreshes journal entries (delete old + create new)
- `rent.py`: `delete_receipt` now deletes associated journal entries
- `rent.py`: Added `GET /api/rent/cash-accounts` endpoint (returns CASH/BANK accounts for a trust)
- `rent.py`: Added `is_deleted==False` filter to `ledger-receipts` endpoint

**Frontend changes:**
- `RentEntryPage.jsx`: Added `debitAccount` field to form state and empty form
- `RentEntryPage.jsx`: Added `fetchCashAccounts` function and `cashAccounts` state
- `RentEntryPage.jsx`: Added "Debit Account (DR)" dropdown in receipt form (CASH/BANK selector)
- `RentEntryPage.jsx`: Passes `debit_account_code` in POST/PUT payload
- `Layout.jsx`: Added responsive sidebar — hidden on mobile with hamburger toggle, overlay backdrop
- `TopBar.jsx`: Added hamburger menu button (visible on mobile only, `md:hidden`)
- `Sidebar.jsx`: Fixed height to use `h-full` for proper rendering in fixed-position mobile mode

**Verified working:**
- TASK 2: Smart Sync Import — all columns present, full upsert logic in place ✓
- TASK 3: Rent Entry — shows real ledger data, new receipts create double-entry ✓
- TASK 4: Cash Position — CASH=34,530 PKR (296 entries), 5 cash/bank accounts ✓
- TASK 5: Journal Entries — 282 transactions in DR/CR pairs, ledger view with running balance ✓
- TASK 6: Investments — SSC/DSC/TERM accounts visible (0 balance — no certificates imported) ✓
- TASK 7: Export — 48 sheets (45 accounts + TB + IS + BS), 413 rows matches DB ✓
- TASK 8: Responsive — sidebar now collapses on mobile, tables have overflow-x-auto, grids stack properly ✓

**Next session priorities:**
1. ~~Implement Majlis Bills page~~ — DONE this session
2. Implement Vouchers page (currently placeholder)
3. Implement Receivables page (currently placeholder)
4. Dashboard Home Page
5. Fix GF/CAPITAL vs EQUITY classification issue in Balance Sheet
6. Import HVHT and BIB WPF data files

---

### Session 2026-05-09 (continued) — TASK-001 Majlis Bills

**Created:**
- `CLAUDE.md` — auto-instructions: read TODO/PROGRESS at session start, work top-to-bottom
- `TODO.md` — 14 prioritised tasks (TASK-001 through TASK-014)

**Backend changes (`majlis.py`):**
- Added `debit_account_code: str = "CASH"` to `MajlisBillBody`
- Added `LedgerEntry` import
- Extracted `_calc_totals(body)` helper to avoid duplication
- Added `_delete_journal_entries(bill_id, db)` — deletes `majl-{id}` and `lchg-{id}` keys
- Added `_create_journal_entries(bill, debit_code, db)` — creates dual-entry pairs:
  - `{debit_code}` DR / `M-SUB` CR for (total − loud_speaker) with key `majl-{id}`
  - `{debit_code}` DR / `L-CHGS` CR for loud_speaker (if > 0) with key `lchg-{id}`
- `create_bill`: calls `_create_journal_entries` after commit
- `delete_bill`: calls `_delete_journal_entries` before deletion
- Added `PUT /api/majlis/{bill_id}` endpoint — updates all fields, refreshes journal entries

**Frontend changes (`MajlisBillsPage.jsx`):**
- Added stat cards: Total Bills, M-SUB Received, L-CHGS Received, Grand Total
- Added `cashAccounts` state + `fetchCashAccounts` (calls `/api/rent/cash-accounts`)
- Added `debitAccount` field to form + dropdown in UI (4-column top row)
- Added journal preview box in form footer (shows DR/CR before saving)
- Added edit mode: pencil button → pre-fills form, blue border on card, "Update Bill" button
- Added "Cancel Edit" button (X icon) to exit edit mode without saving
- Edit row highlighted blue in history table
- Delete confirm mentions journal entries will also be removed

---

### Session 2026-05-09 (second continuation) — TASK-002 through TASK-009

**TASK-002: Vouchers Page**
- `models/models.py`: Added `voucher_type`, `account_code`, `contra_account_code` to `Voucher`
- `main.py`: Added migrations for new voucher columns
- `routers/vouchers.py`: Rewrote with Payment/Receipt dual-entry, PUT endpoint, `_delete_journal_entries` helper; account name looked up from AccountType on save
- `VouchersPage.jsx`: Payment/Receipt tabs (red/green), account selector from `/api/accounts/types` filtered by type, contra CASH/BANK selector, journal preview, edit mode, stat cards

**TASK-003: Receivables Page**
- `ReceivablesPage.jsx`: Added "Rent Arrears" tab (tenant-based, derives months-behind from `last_paid_month/year`, colour codes green/amber/red); space type + plot filters; stat cards; general receivables unchanged

**TASK-004: Dashboard Home Page**
- `routers/dashboard.py` (NEW): `GET /api/dashboard/summary?trust_id=X` — cash balances, investment total, pending receivables, recent 10 DR transactions
- `main.py`: Registered dashboard router
- `DashboardPage.jsx` (NEW): Trust header banner, 4 summary cards (clickable → navigate), cash breakdown, recent transactions table, quick action buttons
- `App.jsx`: Dashboard now default landing page, `onNavigate` prop passed to PageRouter
- `Sidebar.jsx`: Added Overview section with Dashboard link; both Overview + Rent expanded by default
- `TopBar.jsx`: Added "Dashboard" to PAGE_TITLES

**TASK-005: Fix Tenant Rent Rates**
- `routers/tenants.py`: Added `POST /api/tenants/backfill-rates?trust_id=X` — parses `RENT @N` and `WATER @N` patterns from ledger particulars, fills zero-rate tenant fields only
- `TenantsPage.jsx`: Added "Fix Rates" button in toolbar; calls backfill endpoint, refreshes list on success

**TASK-006: Fix GF/CAPITAL vs EQUITY Bug**
- `routers/export_data.py` line 249: Changed `account_type == "EQUITY"` → `account_type in ("EQUITY", "CAPITAL")` in `_build_balance_sheet` (summary reports BS was already fixed for full WPF export)

**TASK-009: Print Rent Receipt**
- `routers/rent.py`: Added `GET /api/rent/receipt/{id}/print` — generates `.docx` via python-docx with receipt header, tenant details, rent/water/arrears lines, total, signature block; returns as file download
- `RentEntryPage.jsx`: Added printer icon button (blue hover) in each receipt row that does `<a href=... download>` to trigger the download

---

### Session 2026-05-09 (third continuation) — TASK-010–014 + Trust Detection Fix

**Trust detection fix (`import_data.py`):**
- Moved HVHT before HTTT in `_TRUST_KEYWORDS` and moved `THAWER` from HTTT to HVHT set (it's the HVHT founder's name, not HTTT)
- Added HUSAMI, TAHERI, TAHIR to HTTT keywords
- `HVHT2023.xlsx` → correctly detected as HVHT; `BIB2022.xls` → correctly detected as BIB

**TASK-010–012: Financial Reports Page**
- `routers/reports.py` (NEW): Three JSON endpoints — `/api/reports/trial-balance`, `/api/reports/income-statement`, `/api/reports/balance-sheet`; all support `?year=N` or `?date_from`/`?date_to` filters
- `main.py`: Registered reports router
- `ReportsPage.jsx` (NEW): Three-tab page — Trial Balance (with CSV download), Income Statement (surplus/deficit row), Balance Sheet (two-column ASSETS vs LIAB+EQUITY with balance-check alert)
- `Sidebar.jsx`: Added "Financial Reports" link under Reports section
- `App.jsx` + `TopBar.jsx`: Wired route and title

**TASK-013: Export Receivables to Excel**
- `routers/export_data.py`: Added `GET /api/export/receivables?trust_id=X&status=Pending` — exports pending receivables as styled xlsx
- `ReceivablesPage.jsx`: Added "Export" download button in General Receivables table header

**TASK-014: Round-Trip Re-import Test**
- Verified HTTT export → re-import: 413 transactions, 0 would-insert, 0 would-flag — lossless
- Note: DEP account sheet is skipped by `_SKIP` list (added per urgent fix); its 0 entries still round-trip correctly (no entries are in DEP in the original data)

---

### Session 2026-05-17 (continued 2) — TASK-032 through TASK-034

**TASK-032: Cash Receivables page**
- `routers/rent.py`: Added `GET /tenant/{id}/receivables`, `GET /receivables`, `PATCH /{id}/collect`
- `routers/majlis.py`: Added `GET /receivables`, `PATCH /{id}/collect`
- `CashReceivablesPage.jsx` (NEW): Two tabs (Rent / Majlis), filter ALL/SHORT/ADVANCE, summary cards, Collect modal, refreshes item list after collection
- `App.jsx`, `Sidebar.jsx`: Wired "Cash Receivables" route under Reports section

**TASK-033: Outstanding balance alert on entry forms**
- `routers/rent.py`: Added `GET /tenant/{id}/receivables` (returns SHORT/ADVANCE receipts for one tenant)
- `RentEntryPage.jsx`: Fetches receivables on tenant change; shows amber alert with per-receipt breakdown if any outstanding
- `MajlisBillsPage.jsx`: Fetches trust-wide majlis receivables on load; shows amber alert in form when opening new bill if any outstanding bills exist

**TASK-034: Cash Position overhaul**
- `routers/cash_position.py` (NEW): `GET /api/cash-position?trust_id=X` (physical cash, receivables, on-account, book income, receivables breakdown); `GET /api/cash-position/all-trusts`
- `main.py`: Registered cash_position router
- `CashPositionPage.jsx`: Rewrote — 4 summary cards (Physical Cash/Receivables/On-Account/Book Income), cash accounts list, receivables breakdown table, all-trusts 3-column panel, recent transactions
- Frontend build: ✅ clean (487 kB JS, 1.06s)

---

### Session 2026-05-17 (continued) — TASK-030 + TASK-031

**TASK-030: Cash received on Rent Receipt**
- `models/models.py`: Added `cash_received` (Float nullable) + `cash_status` (String, default PAID) to `RentReceipt`
- `main.py`: Added migration block for `rent_receipts`; backfills `cash_received = total_amount` for existing rows
- `routers/rent.py`: Added `cash_received: Optional[float] = None` to body; added `_cash_status()` helper; `_serialize()` returns `cash_received`, `cash_status`, `shortfall`; `create_receipt` + `update_receipt` compute and store cash fields
- `RentEntryPage.jsx`: Added `cashReceived`/`noCash` form state; Cash Received input + "No cash received" checkbox with live Total/Cash/Balance/Status preview; history table extended to 11 columns (merged Rent+Water, added Cash Recv + Balance)

**TASK-031: Cash received on Majlis Bill**
- `routers/majlis.py`: Same pattern — `_cash_status()` helper, updated `_serialize()`, `create_bill`, `update_bill`
- `MajlisBillsPage.jsx`: Added `cashReceived`/`noCash` form state; Cash Received input + checkbox; history table extended to 12 columns (added Cash Recv + Balance)
- Frontend build: ✅ clean (469 kB JS, 1.38s)

---

### Session 2026-05-17 — TASK-020 through TASK-024

**TASK-020: Print/PDF export**
- `backend/pdf_utils.py` (NEW): Shared NGODoc class wrapping reportlab — letterhead, KV rows, line items with totals, signature block; `amount_in_words` (PKR Crore/Lakh/Thousand); `hijri_str` via hijri_converter
- `routers/vouchers.py`: Added `GET /{id}/pdf` — A5 voucher PDF inline
- `routers/rent.py`: Added `GET /receipt/{id}/pdf` — A5 receipt PDF inline
- `VouchersPage.jsx`: Printer icon opens PDF in new tab
- `RentEntryPage.jsx`: Printer (PDF) + FileDown (DOCX) buttons per receipt row

**TASK-021: Reports PDF export**
- `routers/reports.py`: Added `POST /api/reports/pdf` with `ReportPDFBody` — builds A4 reportlab for income-statement / balance-sheet / trial-balance; page numbers via canvas callback
- `ReportsPage.jsx`: Added "Export PDF" button; fetches blob, opens in new tab

**TASK-022: Tenant Statement**
- `routers/tenants.py`: Added `GET /{id}/statement` (JSON) + `GET /{id}/statement/pdf` (A4 inline PDF)
- `TenantsPage.jsx`: Added StatementModal — FileText icon per row, wide modal with year picker (chevron nav), summary strip (Total Due / Total Paid / Outstanding), receipt table with totals footer, Print PDF button

**TASK-023: Investment Maturity Alerts**
- `routers/investments.py`: Added `GET /maturing?trust_id=X&days=60` — returns ACTIVE certs within N days, adds `days_remaining` and `urgency` fields (red ≤15 / orange ≤30 / yellow ≤60)
- `DashboardPage.jsx`: Fetches maturing investments; shows amber alert banner with color-coded days and Renew (navigate) button

**TASK-024: Audit Log**
- `models/models.py`: Added `AuditLog` model (trust_id, table_name, record_id, action, description, timestamp)
- `backend/audit.py` (NEW): `log_audit()` helper — appends AuditLog row, does not commit
- `routers/audit_log.py` (NEW): `GET /api/audit-log` with trust/table/action filters + offset/limit pagination
- `main.py`: Registered audit_log router
- Hooks added to: vouchers (create/update/delete), rent_receipts (create/delete), tenants (create/update/delete), investments (create/sell/delete)
- `AuditLogPage.jsx` (NEW): Timestamp, action badge, table badge, record ID, description; client search, server-side filters, pagination
- `Sidebar.jsx`: Added "Settings" section with "Audit Log" link
- `App.jsx`: Wired route and page label

**Frontend build: ✅ clean (462 kB JS, 37 kB CSS, 1.56s)**

### Session 2026-05-24 — TASK-035 through TASK-039

**TASK-035: Collect modal improvements**
- `CashReceivablesPage.jsx`: Complete rewrite with grouped table (group header rows per tenant/event in amber)
- Array-based toast system (`toasts` state) — success toast shows PKR amount + name on collection
- Row fade-out animation: `fadingIds` Set + `fadeTimers` useRef; CSS `opacity-0 transition-all duration-500`, row removed from state after 500ms when status becomes PAID
- `CollectAllModal`: sorted oldest-first by date; checkbox per receipt; distributes entered total across receipts using `min(remaining, shortfall)` per receipt; sequential PATCH calls
- Reprint button (printer icon) on each rent receivable row — opens PDF in new tab via `/api/rent/receipt/{id}/pdf`

**TASK-036: Cash status on rent receipt PDF**
- `backend/pdf_utils.py`: Added `add_payment_status_bar()` method to NGODoc — PAID (green), SHORT (amber), ADVANCE (gray); colored left border, status label + detail text
- `routers/rent.py`: Updated `receipt_pdf` endpoint to call `add_payment_status_bar()` after line items

**TASK-037: Monthly cash summary report**
- `routers/reports.py`: Added `GET /api/reports/monthly-cash?trust_id=X&year=Y` — 12-row response with rent/majlis billed/collected/outstanding/total-cash-in/cumulative per month + totals
- `routers/reports.py`: Added `GET /api/reports/monthly-cash/excel` — styled openpyxl xlsx download
- `ReportsPage.jsx`: Added "mc" tab to TABS array; added `MonthlyCashTab` component (9-column table, Export Excel button, totals row in dark footer); wired into content switcher
- Frontend build: ✅ clean (499 kB JS, 1.09s)

**TASK-038: Tenant payment history card**
- `routers/tenants.py`: Added `GET /api/tenants/{id}/payment-history?year=Y` — 12-month grid data per tenant (status, billed, collected, shortfall per month + yearly totals)
- `TenantsPage.jsx`: Added `BarChart2` (History) action button per row; `PaymentHistoryModal` with 12-cell color grid (4×3), status legend, yearly totals strip, "View Statement" quick-link; `histYear` state + year nav; modal wired via `modal.type === "history"`
- Frontend build: ✅ clean (504 kB JS, 1.09s)

**TASK-039: End of day cash summary**
- `routers/reports.py`: Added `GET /api/reports/daily-summary?trust_id=&date_str=` — today's rent receipts + majlis bills with per-record cash status, summary totals
- `routers/reports.py`: Added `GET /api/reports/daily-summary/pdf` — A4 reportlab PDF with rent/majlis tables and NET CASH IN bar
- `DashboardPage.jsx`: Added `ClipboardList` "End of Day" section card between Quick Actions and Backup; `EodModal` component — summary cards (Billed/Collected/Outstanding), rent receipts table, majlis bills table, Print PDF button; modal shown when `eodOpen` state is true
- Frontend build: ✅ clean (511 kB JS, 1.06s)

---

### Session 2026-05-16 — TASK-015 through TASK-019

**TASK-015: App Packaging**
- `launch.py` — Python launcher using pystray + Pillow: starts uvicorn + npm dev in background, waits for backend, opens browser, shows tray icon with "Open Browser" / "Stop Server" menu
- `NGO Accounting.vbs` — Silent WScript launcher (no console window)
- `create_shortcut.ps1` — Creates `NGO Accounting.lnk` on Desktop pointing to the VBS
- Installed `pystray==0.19.5` and `Pillow==12.2.0` globally

**TASK-016: Data Backup System**
- `routers/backup.py` (NEW): `POST /api/backup/create` — copies DB, builds full Excel workbook for every trust, saves to `backend/Backups/`, persists `last_backup.json`; `GET /api/backup/last` returns last backup timestamp
- `main.py`: Registered backup router
- `routers/dashboard.py`: Imports `_load_meta` from backup, appends `last_backup` timestamp to summary response
- `DashboardPage.jsx`: Added backup bar at bottom — "Backup Now" button, last backup date, success/error toast

**TASK-017: Fiscal Year Closing**
- `models/models.py`: Added `FiscalYearClose` model (trust_id, fiscal_year, closed_at, net_surplus, opening_entries_count, note)
- `routers/fiscal_year.py` (NEW): `GET /preview`, `POST /close`, `GET /closed-years`, `GET /is-locked` — closes income/expense to GF, creates Balance b/d opening entries for next FY
- `FiscalYearClosePage.jsx` (NEW): Year picker, preview (income/expense/surplus + balance accounts table), closing note, confirm dialog, closed years list
- Wired route, sidebar entry ("Fiscal Year Close"), TopBar title
- `main.py`: Registered fiscal_year router + imported FiscalYearClose model

**TASK-018: Global Search**
- `routers/search.py` (NEW): `GET /api/search?trust_id=X&q=Y` — searches ledger_entries by particulars, party_name, receipt_no, account_code, contra, amounts (numeric detect); limit=50
- `main.py`: Registered search router
- `TopBar.jsx`: Added `SearchBar` component — 300ms debounce, dropdown with up to 20 results (date, particulars, account codes, DR/CR amounts), outside-click dismissal

**TASK-019: UI Polish**
- `components/ui.jsx` (NEW): Shared components — `Skeleton`, `SkeletonTable`, `SkeletonCard`, `EmptyState`, `StatCard`, `PageHeader`, `Badge`, `Btn`
- `VouchersPage.jsx`: Stat cards now show skeleton animation while loading
- `MajlisBillsPage.jsx`: Stat cards now show skeleton animation while loading
- `ReceivablesPage.jsx`: Stat cards now show skeleton animation while loading
- `ImportExcelPage.jsx`: Fixed broken `ArrowPathRoundedSquare` import → replaced with `RotateCcw` (frontend build was failing)
- Frontend build: verified clean (`vite build` 762ms, no errors)

---

### Session 2026-05-24 (continued) — TASK-040 through TASK-042

**TASK-040: Arrears auto-carry on rent entry**
- `routers/rent.py`: Added `include_arrears: bool = True` to `RentReceiptBody`; sweeps tenant's SHORT/ADVANCE receipts sorted by date asc before insert; auto-populates `rent_arrears` from total old shortfall; after saving new receipt, distributes cash oldest-first across old outstanding receipts (marks each PAID when fully settled); new receipt gets remainder; returns `arrears_settled_count` + `arrears_auto_filled_count`
- `RentEntryPage.jsx`: Added `useRef`-based field focus; `tenantReceivables` state with `useEffect` fetcher on tenant change; second `useEffect` auto-fills `rentArrears` from total shortfall when `includeArrears` is ON; "Include arrears" amber toggle with outstanding count/amount badge; read-only note shows auto-fill count

**TASK-041: Keyboard shortcuts and quick entry**
- `RentEntryPage.jsx`: Global `useEffect` for Ctrl+S (save), Escape (close dialog / cancel edit); `ref={tenantSelectRef}` on tenant dropdown — focus returned after save; `ref={cashRef}` on cash input with Enter→submit; Quick Entry mode toggle (Zap icon, violet) — shows minimal 4-field form (Tenant | Month | Year | Cash Received), syncs To Period with From Period, hides calc summary and balance breakdown
- `TenantsPage.jsx`: `useEffect` for Ctrl+N (open add-tenant modal), Escape (close modal), Ctrl+S inside modal form (trigger submit)

**TASK-042: Trust-level settings page**
- `models/models.py`: Added `TrustSettings` model (id, trust_id FK unique, address Text, default_water_charge Float, fiscal_year Integer, logo_base64 Text, updated_at DateTime)
- `main.py`: Added `CREATE TABLE trust_settings` migration in `_run_migrations()`; registered `trust_settings_router`
- `routers/trust_settings.py` (NEW): `GET /api/trust-settings/{trust_id}` (returns settings or defaults); `POST /api/trust-settings/{trust_id}` (upsert)
- `pdf_utils.py`: Added `address` + `logo_b64` params to `NGODoc.__init__`; `add_header` shows address line below trust name; embeds logo as reportlab `Image` if provided (handles data-URI prefix)
- `routers/rent.py`: `receipt_pdf` loads `TrustSettings` and passes `address` / `logo_b64` to NGODoc
- `routers/reports.py`: `_report_doc` accepts `address` param; `report_pdf` loads TrustSettings and passes address to all three report-type `_report_doc` calls
- `TrustSettingsPage.jsx` (NEW): Trust tab selector (HVHT/BIB/HTTT), address textarea, default water charge + fiscal year inputs, logo upload (base64 data-URI), logo preview with remove button, save button → POST endpoint, success/error toast
- `Sidebar.jsx`: Added "Trust Settings" link under Settings section
- `App.jsx`: Imported `TrustSettingsPage`, added route case and page label
- Frontend build: ✅ clean (522 kB JS, 1.10s)

---

### Session 2026-05-25 — TASK-045 through TASK-049

**TASK-045: Rent receipt numbering**
- `models/models.py`: Added `receipt_no = Column(String)` to `RentReceipt`
- `main.py`: Migration adds `receipt_no` column if missing; backfills all existing records ordered by `trust_id, date, id` with format `{trust_code}-{year}-{n:04d}` using `defaultdict` counters
- `routers/rent.py`: Added `_next_receipt_no(trust_code, year, trust_id, db)`; `_serialize` includes `receipt_no`; `create_receipt` auto-assigns receipt_no; `_create_journal_entries` uses `receipt_no` as `LedgerEntry.receipt_no`; `receipt_pdf` uses receipt_no in header
- `routers/tenants.py`: Statement rows include `receipt_no`; PDF header uses receipt_no
- `RentEntryPage.jsx`: Table header "Receipt No" instead of "#"; cells show `receipt_no || serial_no`

**TASK-046: Majlis bill numbering**
- `models/models.py`: Added `bill_no = Column(String)` to `MajlisBill`
- `main.py`: Migration adds `bill_no` column; backfills with format `{trust_code}-MAJ-{year}-{n:04d}`
- `routers/majlis.py`: Added `_next_bill_no(trust_code, year, trust_id, db)`; `_serialize` includes `bill_no`; `create_bill` auto-assigns bill_no; loads trust first via `joinedload`
- `MajlisBillsPage.jsx`: Table header "Bill No"; cells show `bill_no || serial_no`

**TASK-047: Account-wise ledger view**
- `routers/accounts.py`: Extended `get_ledger` to compute `opening_balance` (sum of debit−credit for entries strictly before `date_from`); running balance starts from opening balance; response includes `opening_balance`
- `routers/accounts.py`: Added `GET /api/accounts/ledger/excel` — openpyxl export with styled opening balance (blue), data rows, closing balance (green) rows
- `JournalEntriesPage.jsx`: Added `dateFrom`/`dateTo` state (default CY-01-01 / CY-12-31); date range inputs in toolbar; Export Excel `<a>` link; Opening Balance row (blue-tinted) in tbody before entries; wrapped in JSX fragment

**TASK-048: Voucher number auto-sequence**
- `main.py`: Migration backfills old `V-NNN` style voucher_numbers to `{trust_code}-PV/RV-{year}-{n:04d}`
- `routers/vouchers.py`: `VoucherBody` adds `voucher_number: Optional[str]`; rewrote `_next_voucher_no` to accept `trust_code, voucher_type, year`; `GET /next-number` accepts `voucher_type`+`year` params; `create_voucher` uses provided voucher_number or auto-generates; `update_voucher` preserves existing number
- `VouchersPage.jsx`: `EMPTY` includes `voucher_number: ""`; `fetchNextNumber` auto-fills; `startEdit` copies existing number; `handleSubmit` sends `voucher_number`; form shows "Voucher No." input (editable, `font-mono`) after Date field

**TASK-049: Report improvements**
- `routers/reports.py`: Added `timedelta` import
- `routers/reports.py` `trial_balance`: Computes `open_sums` (entries before `date_from`); each row gains `opening_balance`, `closing_balance`, `is_zero`; accounts with zero period AND zero opening balance are hidden; accounts with zero period but nonzero opening balance shown grayed (`is_zero: True`)
- `routers/reports.py` `income_statement`: Adds `is_zero` flag and `pct_of_income` (% of total income) to each income/expense row
- `routers/reports.py` `balance_sheet`: Adds `prior_amount` per row (when `year` set, from `year-1` data); adds `prior_year` dict (totals: assets/liab/equity/net_profit for prior year) to response
- `ReportsPage.jsx` `TrialBalanceTab`: Shows Opening Bal. + Closing Bal. columns when year ≠ "all"; grays out `is_zero` rows; CSV download includes new columns
- `ReportsPage.jsx` `IncomeStatementTab`: Added `% of Income` column (4th col); grays out zero-amount rows; NET SURPLUS row updated to span 3 cols
- `ReportsPage.jsx` `BalanceSheetTab`: Shows `prior_year` column when year selected (per-account `prior_amount` + section prior-year totals rows); grays out `is_zero` rows; inline `BSRow` helper component
- Frontend build: ✅ clean (527 kB JS, 1.09s)
