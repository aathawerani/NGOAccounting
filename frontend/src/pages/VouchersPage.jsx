import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, FileText, AlertCircle, Pencil, X, ArrowDownLeft, ArrowUpRight, Printer } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";
const TODAY = new Date().toISOString().slice(0, 10);

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const EMPTY = {
  date: TODAY,
  account_code: "",
  contra_account_code: "CASH",
  being: "",
  amount: "",
};

function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id}
          className={cn("px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto",
            t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white")}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ voucher, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <h3 className="font-semibold text-gray-900">Delete Voucher?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          {voucher.voucher_number} — {voucher.account_name || voucher.account_code} ({PKR(voucher.amount)}) will be permanently deleted along with its journal entries.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color = "gray" }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold", color === "red" ? "text-red-700" : color === "green" ? "text-emerald-700" : "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function VouchersPage() {
  const { selectedTrust } = useTrust();
  const [tab, setTab] = useState("Payment");
  const [vouchers, setVouchers] = useState([]);
  const [nextNumber, setNextNumber] = useState("V-001");
  const [accountTypes, setAccountTypes] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fetchVouchers = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/vouchers?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setVouchers(await res.json());
    } catch {
      addToast("Failed to load vouchers", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  const fetchNextNumber = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/vouchers/next-number?trust_id=${selectedTrust.id}`);
      if (res.ok) setNextNumber((await res.json()).voucher_number);
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchAccountTypes = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/accounts/types?trust_id=${selectedTrust.id}`);
      if (res.ok) setAccountTypes(await res.json());
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchCashAccounts = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/rent/cash-accounts?trust_id=${selectedTrust.id}`);
      if (res.ok) setCashAccounts(await res.json());
    } catch { /* silent */ }
  }, [selectedTrust]);

  useEffect(() => {
    fetchVouchers();
    fetchNextNumber();
    fetchAccountTypes();
    fetchCashAccounts();
  }, [fetchVouchers, fetchNextNumber, fetchAccountTypes, fetchCashAccounts]);

  // Filter accounts by type for the current tab
  const filteredAccounts = accountTypes.filter((a) => {
    if (tab === "Payment") return ["EXPENSE", "LIABILITY"].includes(a.account_type);
    return ["INCOME", "ASSET"].includes(a.account_type);
  });

  // Reset account_code when tab changes
  function switchTab(newTab) {
    setTab(newTab);
    setForm((f) => ({ ...f, account_code: "" }));
    if (editingId) cancelEdit();
  }

  function startEdit(v) {
    setTab(v.voucher_type || "Payment");
    setForm({
      date: v.date,
      account_code: v.account_code || "",
      contra_account_code: v.contra_account_code || "CASH",
      being: v.being || "",
      amount: v.amount || "",
    });
    setEditingId(v.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTrust) return;
    if (!form.account_code) return addToast("Select an account", "error");
    setSubmitting(true);
    const payload = {
      trust_id: selectedTrust.id,
      date: form.date,
      voucher_type: tab,
      account_code: form.account_code,
      contra_account_code: form.contra_account_code || "CASH",
      being: form.being || null,
      amount: parseFloat(form.amount) || 0,
    };
    try {
      const url = editingId ? `${API}/api/vouchers/${editingId}` : `${API}/api/vouchers`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast(editingId ? "Voucher updated" : "Voucher created");
      setForm(EMPTY);
      setEditingId(null);
      fetchVouchers();
      fetchNextNumber();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/api/vouchers/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setVouchers((p) => p.filter((v) => v.id !== deleteTarget.id));
      addToast("Voucher deleted");
      fetchNextNumber();
      if (editingId === deleteTarget.id) cancelEdit();
    } catch {
      addToast("Failed to delete", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const payments = vouchers.filter((v) => (v.voucher_type || "Payment") === "Payment");
  const receipts = vouchers.filter((v) => v.voucher_type === "Receipt");
  const totalPaid = payments.reduce((s, v) => s + (v.amount || 0), 0);
  const totalReceived = receipts.reduce((s, v) => s + (v.amount || 0), 0);

  const amt = parseFloat(form.amount) || 0;
  const drCode = tab === "Receipt" ? form.contra_account_code : form.account_code;
  const crCode = tab === "Receipt" ? form.account_code : form.contra_account_code;

  const isPayment = tab === "Payment";

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />
      {deleteTarget && (
        <ConfirmDialog voucher={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ── Stat Cards ─────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Payment Vouchers" value={payments.length} />
            <StatCard label="Total Paid Out" value={PKR(totalPaid)} color="red" sub="All payment vouchers" />
            <StatCard label="Receipt Vouchers" value={receipts.length} />
            <StatCard label="Total Received" value={PKR(totalReceived)} color="green" sub="All receipt vouchers" />
          </>
        )}
      </div>

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div className={cn(
        "bg-white rounded-xl shadow-sm border",
        editingId ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
      )}>
        {/* Tab switcher */}
        <div className="flex items-center gap-0 px-6 pt-4 border-b border-gray-100">
          <button
            type="button"
            onClick={() => switchTab("Payment")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "Payment"
                ? "border-red-500 text-red-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <ArrowUpRight className="w-4 h-4" />
            Payment Voucher
          </button>
          <button
            type="button"
            onClick={() => switchTab("Receipt")}
            className={cn(
              "flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors",
              tab === "Receipt"
                ? "border-emerald-500 text-emerald-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            )}
          >
            <ArrowDownLeft className="w-4 h-4" />
            Receipt Voucher
          </button>
          <span className="ml-auto text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded mb-1">
            {editingId ? "Editing" : nextNumber}
          </span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Date */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={set("date")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>

            {/* Account (DR for Payment / CR for Receipt) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {isPayment ? "Expense / Debit Account *" : "Income / Credit Account *"}
              </label>
              <select value={form.account_code} onChange={set("account_code")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="">Select account…</option>
                {filteredAccounts.map((a) => (
                  <option key={a.account_code} value={a.account_code}>
                    {a.account_code} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Contra account (CASH/BANK) */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                {isPayment ? "Paid From (CR)" : "Received Into (DR)"}
              </label>
              <select value={form.contra_account_code} onChange={set("contra_account_code")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {cashAccounts.length === 0 && <option value="CASH">CASH</option>}
                {cashAccounts.map((a) => (
                  <option key={a.account_code} value={a.account_code}>
                    {a.account_code} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>

            {/* Amount */}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount (PKR) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          {/* Being */}
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Being (Particulars)</label>
            <input type="text" value={form.being} onChange={set("being")} placeholder="Description of transaction"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          {/* Journal preview + submit */}
          <div className="pt-2 border-t border-gray-100 space-y-3">
            {amt > 0 && (drCode || crCode) && (
              <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 font-mono">
                <p className="text-gray-500 font-sans font-medium text-xs mb-2">Journal entries that will be created:</p>
                <div className="flex justify-between">
                  <span className="text-gray-700">{drCode || "—"} DR</span>
                  <span className="font-semibold text-gray-900">{PKR(amt)}</span>
                </div>
                <div className="flex justify-between text-gray-500">
                  <span className="pl-4">{crCode || "—"} CR</span>
                  <span>{PKR(amt)}</span>
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3">
              {editingId && (
                <button type="button" onClick={cancelEdit}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50">
                  <X className="w-4 h-4" />
                  Cancel Edit
                </button>
              )}
              <button type="submit" disabled={submitting}
                className={cn(
                  "px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors",
                  editingId ? "bg-blue-600 hover:bg-blue-700" : isPayment ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700"
                )}>
                {submitting ? "Saving…" : editingId ? "Update Voucher" : isPayment ? "Record Payment" : "Record Receipt"}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            All Vouchers
            {!loading && <span className="ml-2 text-xs font-normal text-gray-400">({vouchers.length})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Cash/Bank</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Being</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No vouchers yet</p>
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => {
                  const isPay = (v.voucher_type || "Payment") === "Payment";
                  return (
                    <tr key={v.id} className={cn(
                      "hover:bg-gray-50 transition-colors",
                      editingId === v.id && "bg-blue-50"
                    )}>
                      <td className="px-4 py-3 font-mono text-gray-500">{v.voucher_number}</td>
                      <td className="px-4 py-3">
                        <span className={cn(
                          "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium",
                          isPay ? "bg-red-100 text-red-700" : "bg-emerald-100 text-emerald-700"
                        )}>
                          {isPay ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownLeft className="w-3 h-3" />}
                          {v.voucher_type || "Payment"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(v.date)}</td>
                      <td className="px-4 py-3 font-medium text-gray-900">
                        {v.account_code && <span className="font-mono text-xs text-gray-400 mr-1">{v.account_code}</span>}
                        {v.account_name || v.account_code || "—"}
                      </td>
                      <td className="px-4 py-3 font-mono text-xs text-gray-500">{v.contra_account_code || "—"}</td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{v.being || "—"}</td>
                      <td className={cn(
                        "px-4 py-3 text-right font-semibold",
                        isPay ? "text-red-700" : "text-emerald-700"
                      )}>
                        {isPay ? "−" : "+"}{PKR(v.amount)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <a href={`${API}/api/vouchers/${v.id}/pdf`} target="_blank" rel="noopener noreferrer"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Print PDF">
                            <Printer className="w-4 h-4" />
                          </a>
                          <button onClick={() => startEdit(v)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Edit">
                            <Pencil className="w-4 h-4" />
                          </button>
                          <button onClick={() => setDeleteTarget(v)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors" title="Delete">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
