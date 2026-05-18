from datetime import datetime as _dt_now
from sqlalchemy import Column, Integer, String, Float, Boolean, Date, DateTime, ForeignKey, Text
from sqlalchemy.orm import relationship
from database import Base

# ── NOTE ─────────────────────────────────────────────────────────────────────
# Schema changes require a fresh database. Delete backend/ngo_accounting.db
# before restarting the backend so SQLAlchemy recreates all tables.
# ─────────────────────────────────────────────────────────────────────────────


class Trust(Base):
    __tablename__ = "trusts"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    code = Column(String, unique=True, nullable=False)
    description = Column(Text)


class Plot(Base):
    """Physical properties per trust (e.g. GK6/1 for HVHT, 46GK7 for HTTT)."""
    __tablename__ = "plots"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    code = Column(String, nullable=False)   # "GK6/1", "46GK7", "2BR1", "MAIN" …

    trust = relationship("Trust")


class Tenant(Base):
    """Matches WPF tenant table: TenantName, TrustPlotCode, SpaceType, SpaceNo,
    RentPerMonth, WaterChargesPerMonth, CNIC, LastPaidMonth, LastPaidYear."""
    __tablename__ = "tenants"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    plot_code = Column(String)          # "GK6/1", "46GK7" — foreign label (not FK)
    name = Column(String, nullable=False)
    space_type = Column(String)         # "SHOP" or "FLAT"
    space_number = Column(String)       # "34"
    monthly_rent = Column(Float, default=0.0)
    water_charge = Column(Float, default=0.0)
    cnic = Column(String)               # "12345-1234567-1"
    last_paid_month = Column(Integer)   # 1–12; updated by rent receipt
    last_paid_year = Column(Integer)    # e.g. 2024
    is_active = Column(Boolean, default=True)

    trust = relationship("Trust")


class RentReceipt(Base):
    """Matches WPF rent table. Stores full denormalised receipt so history
    is preserved even if tenant records change later."""
    __tablename__ = "rent_receipts"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    tenant_id = Column(Integer, ForeignKey("tenants.id"), nullable=True)
    serial_no = Column(String)              # "001", "042" — 3-digit zero-padded
    date = Column(Date, nullable=False)     # receipt date
    plot_code = Column(String)
    space_type = Column(String)             # "SHOP" or "FLAT"
    space_number = Column(String)
    monthly_rent = Column(Float, default=0.0)
    water_charge = Column(Float, default=0.0)
    tenant_name = Column(String)            # denormalised for audit trail
    cnic = Column(String)
    from_date = Column(Date)                # 1st of from-month
    to_date = Column(Date)                  # last day of to-month
    rent_arrears = Column(Float, default=0.0)
    water_arrears = Column(Float, default=0.0)
    total_rent = Column(Float, default=0.0)
    total_water = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    cash_received = Column(Float)               # actual cash collected (None → backfilled to total)
    cash_status   = Column(String, default="PAID")  # PAID | SHORT | ADVANCE | NIL
    # WPF-format particulars strings stored for audit / re-print
    rent_particulars = Column(String)
    water_particulars = Column(String)
    arrears_particulars = Column(String)
    water_arrears_particulars = Column(String)

    trust = relationship("Trust")
    tenant = relationship("Tenant")


class AccountType(Base):
    """Matches WPF accounttype table: one row per account per trust."""
    __tablename__ = "account_types"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    account_code = Column(String, nullable=False)   # "CASH", "SSC", "RGK6"
    account_name = Column(String, nullable=False)   # human-readable name
    account_type = Column(String)                   # ASSET | LIABILITY | INCOME | EXPENSE | EQUITY
    is_certificate = Column(Boolean, default=False) # SSC / DSC / BEH — ledger from all-time

    trust = relationship("Trust")


class LedgerEntry(Base):
    """Matches WPF accounts table: dual-entry row (one entry = two rows sharing account_key)."""
    __tablename__ = "ledger_entries"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    account_code = Column(String, nullable=False)       # which account this row belongs to
    date = Column(Date, nullable=False)
    receipt_no = Column(String)
    party_name = Column(String)
    contra_account_code = Column(String)                # the other leg
    particulars = Column(Text)
    debit = Column(Float, default=0.0)
    credit = Column(Float, default=0.0)
    row_order = Column(Integer, default=2)              # 1=opening balance, 2=regular
    account_key = Column(String)                        # shared by both legs of the dual entry
    # Smart-sync columns (v2)
    import_hash = Column(String, index=True)            # MD5(trust_id|account_code|particulars[:50])
    is_deleted = Column(Boolean, default=False)         # flagged when absent from latest import
    validation_warnings = Column(Text)                  # JSON list of warning codes

    trust = relationship("Trust")


class Investment(Base):
    """Will be replaced with full WPF Certificate model when Investments screen
    is built. Kept here as placeholder so other tables still reference it."""
    __tablename__ = "investments"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"))
    folio_number = Column(String)
    certificate_number = Column(String)
    certificate_type = Column(String)   # SSC, DSC, BEH, BSC
    amount = Column(Float, default=0.0)
    status = Column(String, default="ACTIVE")   # ACTIVE | MATURED
    purchase_date = Column(Date)
    certificate_date = Column(Date)
    maturity_date = Column(Date)
    sale_date = Column(Date)
    notes = Column(Text)

    trust = relationship("Trust")
    profits = relationship("InvestmentProfit", back_populates="investment", cascade="all, delete-orphan")


class MajlisBill(Base):
    """Full WPF majlis schema — all 28 line-item fields preserved."""
    __tablename__ = "majlis_bills"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"))
    date = Column(Date)
    hijri_day = Column(String)
    hijri_month = Column(String)
    hijri_year = Column(String)
    serial_no = Column(String)
    from_time = Column(String)
    to_time = Column(String)
    event_name = Column(String)
    # Milk
    milk_qty = Column(Float, default=0.0)
    milk_price = Column(Float, default=0.0)
    milk_total = Column(Float, default=0.0)
    # Sugar
    sugar_qty = Column(Float, default=0.0)
    sugar_price = Column(Float, default=0.0)
    sugar_total = Column(Float, default=0.0)
    # Tea
    tea_qty = Column(Float, default=0.0)
    tea_price = Column(Float, default=0.0)
    tea_total = Column(Float, default=0.0)
    # Individual items
    saffron = Column(Float, default=0.0)
    cardamoms = Column(Float, default=0.0)
    pistachios = Column(Float, default=0.0)
    ice = Column(Float, default=0.0)
    essence = Column(Float, default=0.0)
    miscellaneous = Column(Float, default=0.0)
    miscellaneous_desc = Column(String)
    # Utilities & services
    lights_fans = Column(Float, default=0.0)
    gas = Column(Float, default=0.0)
    loud_speaker = Column(Float, default=0.0)
    molana = Column(Float, default=0.0)
    total_amount = Column(Float, default=0.0)
    cash_received = Column(Float)               # actual cash collected
    cash_status   = Column(String, default="PAID")  # PAID | SHORT | ADVANCE | NIL

    trust = relationship("Trust")


class Voucher(Base):
    __tablename__ = "vouchers"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    date = Column(Date, nullable=False)
    voucher_number = Column(String)
    voucher_type = Column(String, default="Payment")     # "Payment" | "Receipt"
    account_code = Column(String)                         # DR acct (Payment) or CR acct (Receipt)
    account_name = Column(String)                         # display name (denormalised)
    contra_account_code = Column(String, default="CASH")  # CR acct (Payment) or DR acct (Receipt)
    being = Column(Text)                                  # particulars / description
    amount = Column(Float, default=0.0)

    trust = relationship("Trust")


class Receivable(Base):
    __tablename__ = "receivables"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    date = Column(Date, nullable=False)
    receipt_no = Column(String)
    party_name = Column(String)
    particulars = Column(Text)
    amount = Column(Float, default=0.0)
    status = Column(String, default="Pending")  # Pending | Received

    trust = relationship("Trust")


class InvestmentProfit(Base):
    __tablename__ = "investment_profits"

    id = Column(Integer, primary_key=True, index=True)
    investment_id = Column(Integer, ForeignKey("investments.id"), nullable=False)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    date = Column(Date, nullable=False)
    profit_amount = Column(Float, default=0.0)
    withholding_tax = Column(Float, default=0.0)
    net_profit = Column(Float, default=0.0)

    investment = relationship("Investment", back_populates="profits")
    trust = relationship("Trust")


class FiscalYearClose(Base):
    """Records a completed year-end close for a trust's fiscal year."""
    __tablename__ = "fiscal_year_closes"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=False)
    fiscal_year = Column(Integer, nullable=False)   # ending year, e.g. 2024 = Jul 2023–Jun 2024
    closed_at = Column(DateTime, nullable=False)
    net_surplus = Column(Float, default=0.0)        # Income − Expense for the year
    opening_entries_count = Column(Integer, default=0)
    closed_by_note = Column(Text)                   # optional note

    trust = relationship("Trust")


class AuditLog(Base):
    """Tracks create/update/delete operations across key tables."""
    __tablename__ = "audit_logs"

    id = Column(Integer, primary_key=True, index=True)
    trust_id = Column(Integer, ForeignKey("trusts.id"), nullable=True)
    table_name = Column(String, nullable=False, index=True)
    record_id = Column(Integer)
    action = Column(String, nullable=False)     # create | update | delete
    description = Column(Text)
    timestamp = Column(DateTime, nullable=False, default=_dt_now.utcnow)
