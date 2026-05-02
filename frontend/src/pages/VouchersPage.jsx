import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, FileText, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";
const TODAY = new Date().toISOString().slice(0, 10);

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const EXPENSE_ACCOUNTS = [
  "Electricity / Lights & Fans",
  "Gas Charges",
  "Water Charges",
  "Telephone / Internet",
  "Stationery",
  "Repair & Maintenance",
  "Salary",
  "Tax",
  "Charity",
  "Loan from Trustees",
  "Miscellaneous Expenses",
];

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

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
          {voucher.voucher_number} — {voucher.account_name} ({PKR(voucher.amount)}) will be permanently deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

export default function VouchersPage() {
  const { selectedTrust } = useTrust();
  const [vouchers, setVouchers] = useState([]);
  const [nextNumber, setNextNumber] = useState("V-001");
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [form, setForm] = useState({
    date: TODAY,
    account_name: EXPENSE_ACCOUNTS[0],
    custom_account: "",
    being: "",
    amount: "",
  });
  const [useCustomAccount, setUseCustomAccount] = useState(false);

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

  useEffect(() => {
    fetchVouchers();
    fetchNextNumber();
  }, [fetchVouchers, fetchNextNumber]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTrust) return;
    const accountName = useCustomAccount ? form.custom_account : form.account_name;
    if (!accountName) return addToast("Select or enter an account", "error");
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/vouchers`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_id: selectedTrust.id,
          date: form.date,
          account_name: accountName,
          being: form.being || null,
          amount: parseFloat(form.amount) || 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Voucher created");
      setForm({ date: TODAY, account_name: EXPENSE_ACCOUNTS[0], custom_account: "", being: "", amount: "" });
      setUseCustomAccount(false);
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
    } catch {
      addToast("Failed to delete", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const total = vouchers.reduce((s, v) => s + v.amount, 0);

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />
      {deleteTarget && (
        <ConfirmDialog voucher={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ── Form ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <FileText className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">New Voucher</h2>
          <span className="ml-auto text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">{nextNumber}</span>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={set("date")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount (PKR) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-gray-700">Expense Account *</label>
              <button type="button" onClick={() => setUseCustomAccount((v) => !v)}
                className="text-xs text-emerald-600 hover:underline">
                {useCustomAccount ? "Use preset list" : "Enter custom account"}
              </button>
            </div>
            {useCustomAccount ? (
              <input type="text" value={form.custom_account} onChange={set("custom_account")} placeholder="Account name"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            ) : (
              <select value={form.account_name} onChange={set("account_name")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {EXPENSE_ACCOUNTS.map((a) => <option key={a} value={a}>{a}</option>)}
              </select>
            )}
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Being (Particulars)</label>
            <input type="text" value={form.being} onChange={set("being")} placeholder="Description of payment"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>

          <div className="flex justify-end">
            <button type="submit" disabled={submitting}
              className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
              {submitting ? "Saving…" : "Create Voucher"}
            </button>
          </div>
        </form>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Vouchers
            {!loading && <span className="ml-2 text-xs font-normal text-gray-400">({vouchers.length})</span>}
          </h2>
          {vouchers.length > 0 && (
            <span className="text-sm text-gray-500">Total: <strong className="text-gray-900">{PKR(total)}</strong></span>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Being</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 6 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : vouchers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-12 text-center text-gray-400">
                    <FileText className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No vouchers yet</p>
                  </td>
                </tr>
              ) : (
                vouchers.map((v) => (
                  <tr key={v.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-mono text-gray-500">{v.voucher_number}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(v.date)}</td>
                    <td className="px-4 py-3 font-medium text-gray-900">{v.account_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500">{v.being || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{PKR(v.amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => setDeleteTarget(v)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
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
