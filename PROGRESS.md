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

### Cash Position (CashPositionPage)
| Feature | Status | Notes |
|---|---|---|
| Balance cards per CASH/BANK account | ✅ Done | Reads from ledger_entries via accounts API |
| Total liquid assets card | ✅ Done | |
| Recent transactions table | ✅ Done | Last 25, sorted by date desc |
| Running balance per row | ✅ Done | |

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
| Re-import verification (round-trip test) | ⬜ Pending | |

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

---

## Known Bugs / Issues

1. ~~**Ledger endpoint returns is_deleted entries**~~ **FIXED 2026-05-09** — `accounts.py` `get_ledger` now filters `is_deleted=False`.

2. ~~**No double-entry for new rent receipts**~~ **FIXED 2026-05-09** — `rent.py` `create_receipt` now also creates `LedgerEntry` rows (CASH/BANK DR, R-account and W-account CR). `update_receipt` deletes old and recreates. `delete_receipt` also removes associated journal entries.

3. **HVHT and BIB have no ledger data**: Only HTTT has been imported. Other trusts show empty pages.

4. **GF classified as CAPITAL not EQUITY**: Imported from HTTT WPF file. Seeded as EQUITY but import overwrites to CAPITAL. Balance Sheet equity section may miss it.

5. **Tenant rent/water amounts are 0 after import**: Tenants extracted from WPF import don't have monthly_rent / water_charge populated (they come from party_name, not from a rate table). Users must manually set rent rates on the Tenants page before creating receipts that generate ledger entries.

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
