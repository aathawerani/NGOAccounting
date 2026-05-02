import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, Receipt, AlertCircle, Pencil, X, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];
const MONTH_SHORT = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtPeriod(r) {
  if (!r.from_date || !r.to_date) return "—";
  const f = new Date(r.from_date);
  const t = new Date(r.to_date);
  return `${MONTH_SHORT[f.getMonth()]} ${f.getFullYear()} – ${MONTH_SHORT[t.getMonth()]} ${t.getFullYear()}`;
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return `${d.getDate()} ${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
}

const TODAY_ISO = new Date().toISOString().slice(0, 10);
const THIS_MONTH = new Date().getMonth() + 1;
const THIS_YEAR = new Date().getFullYear();

function numMonths(fm, fy, tm, ty) {
  return (ty - fy) * 12 + (tm - fm) + 1;
}

function emptyForm() {
  return {
    tenantId: "",
    receiptDate: TODAY_ISO,
    fromMonth: THIS_MONTH,
    fromYear: THIS_YEAR,
    toMonth: THIS_MONTH,
    toYear: THIS_YEAR,
    rentArrears: "",
    waterArrears: "",
  };
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          "px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto",
          t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Confirm dialog ─────────────────────────────────────────────────────────────
function ConfirmDialog({ receipt, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <h3 className="font-semibold text-gray-900">Delete Receipt?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Receipt #{receipt.serial_no} for <strong>{receipt.tenant_name}</strong> ({fmtPeriod(receipt)}) will be permanently deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Skeleton ──────────────────────────────────────────────────────────────────
function SkeletonRow() {
  return (
    <tr className="animate-pulse">
      {Array.from({ length: 10 }).map((_, i) => (
        <td key={i} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
      ))}
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function RentEntryPage() {
  const { selectedTrust } = useTrust();

  const [tenants, setTenants] = useState([]);
  const [receipts, setReceipts] = useState([]);
  const [nextSerial, setNextSerial] = useState("001");
  const [loadingTenants, setLoadingTenants] = useState(false);
  const [loadingReceipts, setLoadingReceipts] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [editTarget, setEditTarget] = useState(null); // receipt being edited

  const [form, setForm] = useState(emptyForm());
  const editing = editTarget !== null;

  // ── Imported ledger receipts state ────────────────────────────────────────
  const [ledgerReceipts, setLedgerReceipts] = useState([]);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [ledgerTab, setLedgerTab] = useState("rent");
  const [expandedTenants, setExpandedTenants] = useState(new Set());

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const selectedTenant = tenants.find((t) => t.id === Number(form.tenantId)) ?? null;

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchTenants = useCallback(async () => {
    if (!selectedTrust) return;
    setLoadingTenants(true);
    try {
      const res = await fetch(`${API}/api/tenants?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTenants(data.filter((t) => t.is_active));
    } catch {
      addToast("Failed to load tenants", "error");
    } finally {
      setLoadingTenants(false);
    }
  }, [selectedTrust]);

  const fetchReceipts = useCallback(async () => {
    if (!selectedTrust) return;
    setLoadingReceipts(true);
    try {
      const res = await fetch(`${API}/api/rent?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setReceipts(await res.json());
    } catch {
      addToast("Failed to load receipts", "error");
    } finally {
      setLoadingReceipts(false);
    }
  }, [selectedTrust]);

  const fetchNextSerial = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/rent/next-serial?trust_id=${selectedTrust.id}`);
      if (res.ok) setNextSerial((await res.json()).serial_no);
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchLedgerReceipts = useCallback(async () => {
    if (!selectedTrust) return;
    setLoadingLedger(true);
    try {
      const res = await fetch(`${API}/api/rent/ledger-receipts?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setLedgerReceipts(await res.json());
    } catch {
      addToast("Failed to load imported records", "error");
    } finally {
      setLoadingLedger(false);
    }
  }, [selectedTrust]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    setForm(emptyForm());
    setEditTarget(null);
    setExpandedTenants(new Set());
    fetchTenants();
    fetchReceipts();
    fetchNextSerial();
    fetchLedgerReceipts();
  }, [fetchTenants, fetchReceipts, fetchNextSerial, fetchLedgerReceipts]);

  // ── Calculations ─────────────────────────────────────────────────────────────
  const n = form.tenantId
    ? numMonths(form.fromMonth, form.fromYear, form.toMonth, form.toYear)
    : 0;
  const validRange = n > 0;
  const totalRent  = validRange ? n * (selectedTenant?.monthly_rent ?? 0) : 0;
  const totalWater = validRange ? n * (selectedTenant?.water_charge ?? 0) : 0;
  const arrR = parseFloat(form.rentArrears) || 0;
  const arrW = parseFloat(form.waterArrears) || 0;
  const grandTotal = totalRent + totalWater + arrR + arrW;

  // ── Edit helpers ─────────────────────────────────────────────────────────────
  function startEdit(receipt) {
    if (!receipt.from_date || !receipt.to_date) return;
    const f = new Date(receipt.from_date);
    const t = new Date(receipt.to_date);
    setEditTarget(receipt);
    setForm({
      tenantId: String(receipt.tenant_id ?? ""),
      receiptDate: receipt.date ?? TODAY_ISO,
      fromMonth: f.getMonth() + 1,
      fromYear: f.getFullYear(),
      toMonth: t.getMonth() + 1,
      toYear: t.getFullYear(),
      rentArrears: receipt.rent_arrears ? String(receipt.rent_arrears) : "",
      waterArrears: receipt.water_arrears ? String(receipt.water_arrears) : "",
    });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setEditTarget(null);
    setForm(emptyForm());
  }

  // ── Submit ────────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTrust || !form.tenantId) return addToast("Select a tenant first", "error");
    if (!validRange) return addToast("From date must be before or equal to To date", "error");

    setSubmitting(true);
    const payload = {
      trust_id: selectedTrust.id,
      tenant_id: Number(form.tenantId),
      date: form.receiptDate,
      from_month: form.fromMonth,
      from_year: form.fromYear,
      to_month: form.toMonth,
      to_year: form.toYear,
      rent_arrears: arrR,
      water_arrears: arrW,
    };

    try {
      const url    = editing ? `${API}/api/rent/${editTarget.id}` : `${API}/api/rent`;
      const method = editing ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed to save");
      addToast(editing ? "Receipt updated" : "Receipt recorded");
      setForm(emptyForm());
      setEditTarget(null);
      fetchReceipts();
      fetchNextSerial();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Delete ────────────────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/api/rent/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setReceipts((p) => p.filter((r) => r.id !== deleteTarget.id));
      addToast("Receipt deleted");
      fetchNextSerial();
    } catch {
      addToast("Failed to delete receipt", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const yearOptions = [];
  for (let y = THIS_YEAR - 5; y <= THIS_YEAR + 2; y++) yearOptions.push(y);

  const lastPaidLabel = selectedTenant?.last_paid_month
    ? `${MONTH_SHORT[selectedTenant.last_paid_month - 1]} ${selectedTenant.last_paid_year}`
    : "Not recorded";

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />
      {deleteTarget && (
        <ConfirmDialog receipt={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ── Entry / Edit Form ────────────────────────────────────────────── */}
      <div className={cn("bg-white rounded-xl shadow-sm border", editing ? "border-amber-300 ring-2 ring-amber-200" : "border-gray-200")}>
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <Receipt className={cn("w-5 h-5", editing ? "text-amber-500" : "text-emerald-600")} />
          <h2 className="text-base font-semibold text-gray-900">
            {editing ? `Editing Receipt #${editTarget.serial_no}` : "New Rent Receipt"}
          </h2>
          {!editing && (
            <span className="ml-auto text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">
              #{nextSerial}
            </span>
          )}
          {editing && (
            <button onClick={cancelEdit} className="ml-auto flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800">
              <X className="w-4 h-4" /> Cancel Edit
            </button>
          )}
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {/* Row 1: Tenant + Date */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Tenant *</label>
              <select
                value={form.tenantId}
                onChange={(e) => setForm((f) => ({ ...f, tenantId: e.target.value }))}
                required
                disabled={loadingTenants}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
              >
                <option value="">{loadingTenants ? "Loading…" : "Select tenant…"}</option>
                {tenants.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} — {t.space_type} {t.space_number}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Receipt Date *</label>
              <input
                type="date"
                value={form.receiptDate}
                onChange={(e) => setForm((f) => ({ ...f, receiptDate: e.target.value }))}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
            </div>
          </div>

          {/* Tenant info */}
          {selectedTenant && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 p-4 bg-emerald-50 rounded-lg border border-emerald-100 text-sm">
              <div><span className="text-xs text-gray-500 block">Plot</span><span className="font-medium">{selectedTenant.plot_code ?? "—"}</span></div>
              <div><span className="text-xs text-gray-500 block">Space</span><span className="font-medium">{selectedTenant.space_type} {selectedTenant.space_number}</span></div>
              <div><span className="text-xs text-gray-500 block">Monthly Rent</span><span className="font-medium">{PKR(selectedTenant.monthly_rent)}</span></div>
              <div><span className="text-xs text-gray-500 block">Water Charge</span><span className="font-medium">{PKR(selectedTenant.water_charge)}</span></div>
              <div><span className="text-xs text-gray-500 block">CNIC</span><span className="font-medium">{selectedTenant.cnic ?? "—"}</span></div>
              <div>
                <span className="text-xs text-gray-500 block">Last Paid</span>
                <span className={cn("font-medium", !selectedTenant.last_paid_month && "text-amber-600")}>
                  {lastPaidLabel}
                </span>
              </div>
            </div>
          )}

          {/* Period */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">From Period *</label>
              <div className="flex gap-2">
                <select value={form.fromMonth} onChange={(e) => setForm((f) => ({ ...f, fromMonth: Number(e.target.value) }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={form.fromYear} onChange={(e) => setForm((f) => ({ ...f, fromYear: Number(e.target.value) }))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">To Period *</label>
              <div className="flex gap-2">
                <select value={form.toMonth} onChange={(e) => setForm((f) => ({ ...f, toMonth: Number(e.target.value) }))}
                  className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {MONTHS.map((m, i) => <option key={i + 1} value={i + 1}>{m}</option>)}
                </select>
                <select value={form.toYear} onChange={(e) => setForm((f) => ({ ...f, toYear: Number(e.target.value) }))}
                  className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {yearOptions.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Arrears */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Rent Arrears (PKR)</label>
              <input type="number" min="0" step="0.01" value={form.rentArrears} placeholder="0"
                onChange={(e) => setForm((f) => ({ ...f, rentArrears: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Water Arrears (PKR)</label>
              <input type="number" min="0" step="0.01" value={form.waterArrears} placeholder="0"
                onChange={(e) => setForm((f) => ({ ...f, waterArrears: e.target.value }))}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Calculation summary */}
          {form.tenantId && (
            <div className={cn("rounded-lg border p-4 text-sm", validRange ? "bg-blue-50 border-blue-100" : "bg-amber-50 border-amber-200")}>
              {!validRange ? (
                <p className="text-amber-700 font-medium">From date must be before or equal to To date.</p>
              ) : (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div><span className="text-xs text-gray-500 block">Months</span><span className="font-semibold">{n}</span></div>
                  <div><span className="text-xs text-gray-500 block">Total Rent</span><span className="font-semibold">{PKR(totalRent)}</span></div>
                  <div><span className="text-xs text-gray-500 block">Total Water</span><span className="font-semibold">{PKR(totalWater)}</span></div>
                  <div><span className="text-xs text-gray-500 block">Grand Total</span><span className="font-bold text-emerald-700 text-base">{PKR(grandTotal)}</span></div>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-3">
            {editing && (
              <button type="button" onClick={cancelEdit}
                className="px-5 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                Cancel
              </button>
            )}
            <button type="submit" disabled={submitting || !validRange || !form.tenantId}
              className={cn(
                "px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors",
                editing ? "bg-amber-500 hover:bg-amber-600" : "bg-emerald-600 hover:bg-emerald-700"
              )}>
              {submitting ? "Saving…" : editing ? "Update Receipt" : "Record Receipt"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Receipt History ──────────────────────────────────────────────── */}
      {(() => {
        // ── Imported records logic (grouped by tenant) ─────────────────────
        const filtered = ledgerReceipts.filter((e) => e.entry_type === ledgerTab);
        const groupMap = {};
        for (const e of filtered) {
          if (!groupMap[e.party_name]) {
            groupMap[e.party_name] = { name: e.party_name, property: e.property, entries: [], total: 0 };
          }
          groupMap[e.party_name].entries.push(e);
          groupMap[e.party_name].total += e.amount;
        }
        const groups = Object.values(groupMap).sort((a, b) => a.name.localeCompare(b.name));
        const rentCount  = ledgerReceipts.filter((e) => e.entry_type === "rent").length;
        const waterCount = ledgerReceipts.filter((e) => e.entry_type === "water").length;

        return (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex flex-wrap items-center gap-3 px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Imported Rent &amp; Water Records
                {!loadingLedger && (
                  <span className="ml-2 text-xs font-normal text-gray-400">({ledgerReceipts.length})</span>
                )}
              </h2>
              <div className="ml-auto flex gap-1">
                {[
                  { key: "rent",  label: `Rent (${rentCount})` },
                  { key: "water", label: `Water (${waterCount})` },
                ].map(({ key, label }) => (
                  <button
                    key={key}
                    onClick={() => setLedgerTab(key)}
                    className={cn(
                      "px-3 py-1.5 rounded-lg text-xs font-medium transition-colors",
                      ledgerTab === key
                        ? "bg-emerald-600 text-white"
                        : "border border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-600"
                    )}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            {loadingLedger ? (
              <div className="px-6 py-8 text-center text-gray-400 text-sm animate-pulse">Loading imported records…</div>
            ) : groups.length === 0 ? (
              <div className="px-6 py-10 text-center text-gray-400">
                <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="font-medium">No imported {ledgerTab} records</p>
              </div>
            ) : (
              <div className="divide-y divide-gray-100">
                {groups.map((group) => {
                  const isOpen = expandedTenants.has(group.name);
                  return (
                    <div key={group.name}>
                      {/* Tenant header row */}
                      <button
                        onClick={() => {
                          setExpandedTenants((prev) => {
                            const next = new Set(prev);
                            isOpen ? next.delete(group.name) : next.add(group.name);
                            return next;
                          });
                        }}
                        className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left"
                      >
                        {isOpen
                          ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" />
                          : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                        <span className="font-medium text-gray-900 flex-1 text-sm">{group.name}</span>
                        {group.property && (
                          <span className="text-xs font-mono bg-gray-100 text-gray-600 px-2 py-0.5 rounded">
                            {group.property}
                          </span>
                        )}
                        <span className="text-xs text-gray-500 ml-2">
                          {group.entries.length} receipt{group.entries.length !== 1 ? "s" : ""}
                        </span>
                        <span className="text-sm font-semibold text-emerald-700 ml-4">
                          {PKR(group.total)}
                        </span>
                      </button>

                      {/* Expanded detail rows */}
                      {isOpen && (
                        <div className="overflow-x-auto bg-gray-50 border-t border-gray-100">
                          <table className="w-full text-xs">
                            <thead>
                              <tr className="bg-slate-100 border-b border-gray-200">
                                {["Date", "Ref", "Amount", "Particulars"].map((h, i) => (
                                  <th key={i} className={cn(
                                    "px-4 py-2 font-medium text-gray-600 whitespace-nowrap",
                                    i === 2 ? "text-right" : "text-left"
                                  )}>{h}</th>
                                ))}
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                              {group.entries.map((e, idx) => (
                                <tr key={e.id} className={idx % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                                  <td className="px-4 py-2 whitespace-nowrap text-gray-600">{fmtDate(e.date)}</td>
                                  <td className="px-4 py-2 font-mono text-gray-500">{e.receipt_no || "—"}</td>
                                  <td className="px-4 py-2 text-right font-semibold text-emerald-700">{PKR(e.amount)}</td>
                                  <td className="px-4 py-2 text-gray-600 max-w-xs truncate">{e.particulars || "—"}</td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })()}

      {/* ── Receipt History ──────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Receipt History
            {!loadingReceipts && <span className="ml-2 text-xs font-normal text-gray-400">({receipts.length})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                {["#","Date","Tenant","Space","Period","Rent","Water","Arrears","Total",""].map((h, i) => (
                  <th key={i} className={cn("px-4 py-3 font-medium text-gray-600 whitespace-nowrap", i >= 5 ? "text-right" : "text-left")}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loadingReceipts ? (
                Array.from({ length: 4 }).map((_, i) => <SkeletonRow key={i} />)
              ) : receipts.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-12 text-center text-gray-400">
                    <Receipt className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No receipts recorded yet</p>
                  </td>
                </tr>
              ) : (
                receipts.map((r) => (
                  <tr key={r.id} className={cn("hover:bg-gray-50 transition-colors", editTarget?.id === r.id && "bg-amber-50")}>
                    <td className="px-4 py-3 font-mono text-gray-500">{r.serial_no}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{r.tenant_name}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{r.space_type} {r.space_number}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtPeriod(r)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{PKR(r.total_rent)}</td>
                    <td className="px-4 py-3 text-right text-gray-700">{PKR(r.total_water)}</td>
                    <td className="px-4 py-3 text-right text-gray-600">
                      {(r.rent_arrears || r.water_arrears)
                        ? PKR((r.rent_arrears ?? 0) + (r.water_arrears ?? 0))
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{PKR(r.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button onClick={() => startEdit(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors" title="Edit">
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button onClick={() => setDeleteTarget(r)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
