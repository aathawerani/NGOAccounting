import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, TrendingUp, AlertCircle, PlusCircle, DollarSign, CheckCircle } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";
const CERT_TYPES = ["SSC", "DSC", "BEH", "BSC", "TERM"];
const TODAY = new Date().toISOString().slice(0, 10);

// Account codes that represent investments (certificates or term deposits)
const isInvestmentAccount = (a) =>
  a.is_certificate ||
  a.account_code === "TERM" ||
  a.account_code.startsWith("TERM");

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

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

// ── Purchase Modal ─────────────────────────────────────────────────────────────
function PurchaseModal({ onSave, onClose, submitting }) {
  const [form, setForm] = useState({
    certificate_type: "SSC",
    certificate_number: "",
    folio_number: "",
    amount: "",
    purchase_date: TODAY,
    certificate_date: TODAY,
    maturity_date: "",
    notes: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">Purchase Certificate</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Type *</label>
              <select value={form.certificate_type} onChange={set("certificate_type")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {CERT_TYPES.map((t) => <option key={t}>{t}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Amount (PKR) *</label>
              <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Certificate No. *</label>
              <input type="text" value={form.certificate_number} onChange={set("certificate_number")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Folio No.</label>
              <input type="text" value={form.folio_number} onChange={set("folio_number")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Purchase Date *</label>
              <input type="date" value={form.purchase_date} onChange={set("purchase_date")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Certificate Date</label>
              <input type="date" value={form.certificate_date} onChange={set("certificate_date")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Maturity Date</label>
              <input type="date" value={form.maturity_date} onChange={set("maturity_date")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Notes</label>
            <input type="text" value={form.notes} onChange={set("notes")}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={submitting || !form.certificate_number || !form.amount}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Purchase"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Profit Modal ───────────────────────────────────────────────────────────────
function ProfitModal({ investment, onSave, onClose, submitting }) {
  const [form, setForm] = useState({ date: TODAY, profit_amount: "", withholding_tax: "" });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const net = (parseFloat(form.profit_amount) || 0) - (parseFloat(form.withholding_tax) || 0);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <DollarSign className="w-5 h-5 text-blue-600" />
          <h3 className="font-semibold text-gray-900">Record Profit</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            {investment.certificate_type} · {investment.certificate_number} · {PKR(investment.amount)}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
            <input type="date" value={form.date} onChange={set("date")} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Profit Amount (PKR) *</label>
            <input type="number" min="0" step="0.01" value={form.profit_amount} onChange={set("profit_amount")} placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Withholding Tax (PKR)</label>
            <input type="number" min="0" step="0.01" value={form.withholding_tax} onChange={set("withholding_tax")} placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="bg-blue-50 rounded-lg p-3 text-sm">
            <span className="text-gray-500">Net Profit: </span>
            <span className="font-bold text-blue-700">{PKR(net)}</span>
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave(form)} disabled={submitting || !form.profit_amount}
            className="px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Record"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Sell Modal ─────────────────────────────────────────────────────────────────
function SellModal({ investment, onSave, onClose, submitting }) {
  const [saleDate, setSaleDate] = useState(TODAY);

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <CheckCircle className="w-5 h-5 text-amber-600" />
          <h3 className="font-semibold text-gray-900">Mark as Matured / Sold</h3>
        </div>
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            {investment.certificate_type} · {investment.certificate_number} · {PKR(investment.amount)}
          </p>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Sale / Maturity Date *</label>
            <input type="date" value={saleDate} onChange={(e) => setSaleDate(e.target.value)} required
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={() => onSave({ sale_date: saleDate })} disabled={submitting}
            className="px-4 py-2 text-sm rounded-lg bg-amber-600 text-white hover:bg-amber-700 disabled:opacity-50">
            {submitting ? "Saving…" : "Confirm Matured"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Confirm Delete ─────────────────────────────────────────────────────────────
function ConfirmDialog({ inv, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <h3 className="font-semibold text-gray-900">Delete Certificate?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          {inv.certificate_type} · {inv.certificate_number} ({PKR(inv.amount)}) will be permanently deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function InvestmentsPage() {
  const { selectedTrust } = useTrust();
  const [investments, setInvestments] = useState([]);
  const [certLedgers, setCertLedgers] = useState([]); // [{ code, name, balance, entries }]
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [filterType, setFilterType] = useState("ALL");
  const [includeMatured, setIncludeMatured] = useState(false);
  const [modal, setModal] = useState(null); // "purchase" | "profit" | "sell" | "delete"
  const [activeInv, setActiveInv] = useState(null);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const fetchCertLedgers = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const typesRes = await fetch(`${API}/api/accounts/types?trust_id=${selectedTrust.id}`);
      if (!typesRes.ok) return;
      const types = await typesRes.json();
      const certTypes = types.filter(isInvestmentAccount);
      const ledgers = await Promise.all(
        certTypes.map(async (a) => {
          try {
            const res = await fetch(
              `${API}/api/accounts/ledger?trust_id=${selectedTrust.id}&account_code=${encodeURIComponent(a.account_code)}`
            );
            if (!res.ok) return { ...a, balance: 0, entryCount: 0 };
            const d = await res.json();
            return { ...a, balance: d.balance, entryCount: d.entries.length };
          } catch {
            return { ...a, balance: 0, entryCount: 0 };
          }
        })
      );
      setCertLedgers(ledgers);
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchInvestments = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ trust_id: selectedTrust.id, include_matured: includeMatured });
      if (filterType !== "ALL") params.set("cert_type", filterType);
      const res = await fetch(`${API}/api/investments?${params}`);
      if (!res.ok) throw new Error();
      setInvestments(await res.json());
    } catch {
      addToast("Failed to load investments", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust, filterType, includeMatured]);

  useEffect(() => { fetchInvestments(); fetchCertLedgers(); }, [fetchInvestments, fetchCertLedgers]);

  async function handlePurchase(form) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/investments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_id: selectedTrust.id,
          certificate_type: form.certificate_type,
          certificate_number: form.certificate_number,
          folio_number: form.folio_number || null,
          amount: parseFloat(form.amount),
          purchase_date: form.purchase_date,
          certificate_date: form.certificate_date || null,
          maturity_date: form.maturity_date || null,
          notes: form.notes || null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Certificate purchased");
      setModal(null);
      fetchInvestments();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleProfit(form) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/investments/${activeInv.id}/profit`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          date: form.date,
          profit_amount: parseFloat(form.profit_amount),
          withholding_tax: parseFloat(form.withholding_tax) || 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Profit recorded");
      setModal(null);
      fetchInvestments();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleSell(form) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/investments/${activeInv.id}/sell`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sale_date: form.sale_date }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Marked as matured");
      setModal(null);
      fetchInvestments();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/investments/${activeInv.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setInvestments((p) => p.filter((i) => i.id !== activeInv.id));
      addToast("Certificate deleted");
      setModal(null);
    } catch {
      addToast("Failed to delete", "error");
    } finally {
      setSubmitting(false);
    }
  }

  const totalActive = investments
    .filter((i) => i.status === "ACTIVE")
    .reduce((s, i) => s + i.amount, 0);

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />

      {modal === "purchase" && (
        <PurchaseModal onSave={handlePurchase} onClose={() => setModal(null)} submitting={submitting} />
      )}
      {modal === "profit" && activeInv && (
        <ProfitModal investment={activeInv} onSave={handleProfit} onClose={() => setModal(null)} submitting={submitting} />
      )}
      {modal === "sell" && activeInv && (
        <SellModal investment={activeInv} onSave={handleSell} onClose={() => setModal(null)} submitting={submitting} />
      )}
      {modal === "delete" && activeInv && (
        <ConfirmDialog inv={activeInv} onConfirm={handleDelete} onCancel={() => setModal(null)} />
      )}

      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-4">
        {/* Active portfolio total */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5 flex items-center gap-4 flex-1 min-w-56">
          <TrendingUp className="w-8 h-8 text-emerald-600 shrink-0" />
          <div>
            <p className="text-xs text-gray-500">Active Portfolio Value</p>
            <p className="text-2xl font-bold text-gray-900">{PKR(totalActive)}</p>
          </div>
          <div className="ml-auto">
            <button
              onClick={() => setModal("purchase")}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700"
            >
              <PlusCircle className="w-4 h-4" /> Purchase Certificate
            </button>
          </div>
        </div>
      </div>

      {/* ── Certificate ledger balances ────────────────────────────────────── */}
      {certLedgers.length > 0 && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100">
            <DollarSign className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-semibold text-gray-800">Investment Account Balances (Ledger)</h3>
            <span className="ml-auto text-xs text-gray-400">from journal entries</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 divide-x divide-y divide-gray-100">
            {certLedgers.map((a) => {
              const portfolioForType = investments
                .filter((i) => i.status === "ACTIVE" && i.certificate_type === a.account_code)
                .reduce((s, i) => s + i.amount, 0);
              const diff = a.balance - portfolioForType;
              return (
                <div key={a.account_code} className="p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-xs font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded font-mono">
                      {a.account_code}
                    </span>
                    <span className="text-xs text-gray-500 truncate">{a.account_name}</span>
                  </div>
                  <p className="text-lg font-bold text-gray-900">{PKR(a.balance)}</p>
                  <p className="text-xs text-gray-400">{a.entryCount} ledger entries</p>
                  {portfolioForType > 0 && (
                    <p className={cn(
                      "text-xs mt-1 font-medium",
                      Math.abs(diff) < 1 ? "text-emerald-600" : "text-amber-600"
                    )}>
                      {Math.abs(diff) < 1
                        ? "Balanced with portfolio"
                        : `${diff > 0 ? "+" : ""}${PKR(diff)} vs portfolio`}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Filter bar ────────────────────────────────────────────────────── */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
          {["ALL", ...CERT_TYPES].map((t) => (
            <button key={t} onClick={() => setFilterType(t)}
              className={cn("px-3 py-1.5 text-sm font-medium transition-colors",
                filterType === t ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50")}>
              {t}
            </button>
          ))}
        </div>
        <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
          <input type="checkbox" checked={includeMatured} onChange={(e) => setIncludeMatured(e.target.checked)}
            className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
          Show matured
        </label>
      </div>

      {/* ── Table ─────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Type</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Cert No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Folio</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Purchase Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Maturity Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Net Profits</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : investments.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                    <TrendingUp className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No certificates found</p>
                    <p className="text-xs mt-1">Click "Purchase Certificate" to add one.</p>
                  </td>
                </tr>
              ) : (
                investments.map((inv) => {
                  const totalProfit = inv.profits.reduce((s, p) => s + p.net_profit, 0);
                  return (
                    <tr key={inv.id} className={cn("hover:bg-gray-50 transition-colors", inv.status === "MATURED" && "opacity-60")}>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-bold bg-blue-100 text-blue-700">{inv.certificate_type}</span>
                      </td>
                      <td className="px-4 py-3 font-mono text-gray-700">{inv.certificate_number}</td>
                      <td className="px-4 py-3 text-gray-500">{inv.folio_number || "—"}</td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{PKR(inv.amount)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inv.purchase_date)}</td>
                      <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(inv.maturity_date)}</td>
                      <td className="px-4 py-3">
                        <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                          inv.status === "ACTIVE" ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-500")}>
                          {inv.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">
                        {totalProfit > 0 ? PKR(totalProfit) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {inv.status === "ACTIVE" && (
                            <>
                              <button onClick={() => { setActiveInv(inv); setModal("profit"); }}
                                title="Record profit"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
                                <DollarSign className="w-4 h-4" />
                              </button>
                              <button onClick={() => { setActiveInv(inv); setModal("sell"); }}
                                title="Mark as matured"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-amber-600 hover:bg-amber-50 transition-colors">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            </>
                          )}
                          <button onClick={() => { setActiveInv(inv); setModal("delete"); }}
                            title="Delete"
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
