# TODO — NGO Accounting

- [x] TASK-001: Majlis Bills Page — full CRUD with double-entry | Priority: HIGH | Details: Add summary cards, fiscal year filter, debit account dropdown, PUT update endpoint, double-entry LedgerEntry on create/update/delete (CASH DR, M-SUB CR bill-minus-loudspeaker, L-CHGS CR loudspeaker)
- [x] TASK-002: Vouchers Page | Priority: HIGH | Details: Generic payment/receipt journal vouchers. Tabs: Payment / Receipt. Fields: date, voucher_no, account, particulars, amount. Double-entry: debit=CASH/BANK for payment, credit=CASH/BANK for receipt.
- [x] TASK-003: Receivables Page | Priority: HIGH | Details: Outstanding rent per tenant with colour coding (green=paid, amber=1 month behind, red=2+ months). Mark received button. Filter by plot/space type.
- [x] TASK-004: Dashboard Home Page | Priority: HIGH | Details: Summary cards: total cash balance, rent collected this month, outstanding receivables, total investment value. Recent 10 transactions. Link each card to the relevant page.
- [x] TASK-005: Fix Tenant Rent Rates | Priority: MED | Details: Parse `@ (\d+) PM` from imported HTTT particulars to populate monthly_rent and water_charge on tenants. Run as a backend one-off endpoint or script.
- [x] TASK-006: Fix GF/CAPITAL vs EQUITY Bug | Priority: MED | Details: WPF import overwrites GF to CAPITAL. Balance Sheet equity section must include both EQUITY and CAPITAL account_type values so GF appears correctly.
- [ ] TASK-007: Import HVHT Excel File | Priority: MED | Details: User must provide the HVHT WPF export file. Use existing ImportExcelPage smart-sync.
- [ ] TASK-008: Import BIB Excel File | Priority: MED | Details: User must provide the BIB WPF export file. Use existing ImportExcelPage smart-sync.
- [x] TASK-009: Print Rent Receipt | Priority: MED | Details: python-docx template. GET /api/rent/receipt/{id}/print returns .docx. Frontend "Print" button on each receipt row.
- [ ] TASK-010: Trial Balance In-App View | Priority: LOW | Details: Table of all accounts with debit total, credit total, balance. Fiscal year filter. Download CSV button.
- [ ] TASK-011: Income Statement In-App View | Priority: LOW | Details: INCOME accounts vs EXPENSE accounts, net surplus/deficit. Fiscal year filter.
- [ ] TASK-012: Balance Sheet In-App View | Priority: LOW | Details: ASSET / LIABILITY / EQUITY sections. Fiscal year filter.
- [ ] TASK-013: Export Receivables to Excel | Priority: LOW | Details: GET /api/export/receivables — list of all pending receivables per trust as .xlsx.
- [ ] TASK-014: Round-Trip Re-import Test | Priority: LOW | Details: Export HTTT full workbook → re-import → verify row counts match original (413 entries, 45 accounts).
