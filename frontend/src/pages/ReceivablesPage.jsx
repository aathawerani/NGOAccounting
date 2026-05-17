import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, Inbox, CheckCircle, AlertCircle, Users, ClipboardList, Download } from "lucide-react";
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

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function monthsBehind(lastMonth, lastYear) {
  if (!lastMonth || !lastYear) return null;
  const now = new Date();
  return (now.getFullYear() - lastYear) * 12 + (now.getMonth() + 1 - lastMonth);
}

function arrearsBadge(months) {
  if (months === null) return { label: "Unknown", cls: "bg-gray-100 text-gray-600" };
  if (months <= 0) return { label: "Current", cls: "bg-emerald-100 text-emerald-700" };
  if (months === 1) return { label: "1 month behind", cls: "bg-amber-100 text-amber-700" };
  return { label: `${months} months behind`, cls: "bg-red-100 text-red-700" };
}

function rowBg(months) {
  if (months === null) return "";
  if (months <= 0) return "";
  if (months === 1) return "bg-amber-50/40";
  return "bg-red-50/40";
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

function ConfirmDialog({ item, action, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className={cn("w-6 h-6 shrink-0", action === "delete" ? "text-red-500" : "text-emerald-500")} />
          <h3 className="font-semibold text-gray-900">
            {action === "delete" ? "Delete Receivable?" : "Mark as Received?"}
          </h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          <strong>{item.party_name || "—"}</strong> — {PKR(item.amount)}
          {item.particulars ? ` (${item.particulars})` : ""}
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm}
            className={cn("px-4 py-2 text-sm rounded-lg text-white",
              action === "delete" ? "bg-red-600 hover:bg-red-700" : "bg-emerald-600 hover:bg-emerald-700")}>
            {action === "delete" ? "Delete" : "Mark Received"}
          </button>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold",
        color === "red" ? "text-red-700" : color === "amber" ? "text-amber-700" : "text-gray-900"
      )}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function ReceivablesPage() {
  const { selectedTrust } = useTrust();
  const [tab, setTab] = useState("arrears");

  // Rent arrears state
  const [tenants, setTenants] = useState([]);
  const [tenantsLoading, setTenantsLoading] = useState(false);
  const [spaceFilter, setSpaceFilter] = useState("All");
  const [plotFilter, setPlotFilter] = useState("All");

  // General receivables state
  const [receivables, setReceivables] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [showReceived, setShowReceived] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toasts, setToasts] = useState([]);

  const [form, setForm] = useState({
    date: TODAY, receipt_no: "", party_name: "", particulars: "", amount: "",
  });

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const fetchTenants = useCallback(async () => {
    if (!selectedTrust) return;
    setTenantsLoading(true);
    try {
      const res = await fetch(`${API}/api/tenants?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setTenants(await res.json());
    } catch {
      addToast("Failed to load tenants", "error");
    } finally {
      setTenantsLoading(false);
    }
  }, [selectedTrust]);

  const fetchReceivables = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ trust_id: selectedTrust.id });
      if (!showReceived) params.set("status", "Pending");
      const res = await fetch(`${API}/api/receivables?${params}`);
      if (!res.ok) throw new Error();
      setReceivables(await res.json());
    } catch {
      addToast("Failed to load receivables", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust, showReceived]);

  useEffect(() => {
    fetchTenants();
    fetchReceivables();
  }, [fetchTenants, fetchReceivables]);

  // Derive arrears from tenants
  const activeTenants = tenants.filter((t) => t.is_active);
  const uniquePlots = [...new Set(activeTenants.map((t) => t.plot_code).filter(Boolean))].sort();
  const filteredTenants = activeTenants.filter((t) => {
    if (spaceFilter !== "All" && t.space_type !== spaceFilter) return false;
    if (plotFilter !== "All" && t.plot_code !== plotFilter) return false;
    return true;
  }).map((t) => ({
    ...t,
    months: monthsBehind(t.last_paid_month, t.last_paid_year),
    estOutstanding: Math.max(0, monthsBehind(t.last_paid_month, t.last_paid_year) || 0)
      * ((t.monthly_rent || 0) + (t.water_charge || 0)),
  })).sort((a, b) => (b.months ?? -1) - (a.months ?? -1));

  const overdueCount = filteredTenants.filter((t) => t.months !== null && t.months >= 1).length;
  const totalEstOutstanding = filteredTenants.reduce((s, t) => s + t.estOutstanding, 0);

  // General receivables stats
  const pending = receivables.filter((r) => r.status === "Pending");
  const pendingTotal = pending.reduce((s, r) => s + r.amount, 0);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTrust) return;
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/receivables`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_id: selectedTrust.id,
          date: form.date,
          receipt_no: form.receipt_no || null,
          party_name: form.party_name || null,
          particulars: form.particulars || null,
          amount: parseFloat(form.amount) || 0,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Receivable added");
      setForm({ date: TODAY, receipt_no: "", party_name: "", particulars: "", amount: "" });
      fetchReceivables();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleConfirm() {
    if (!confirm) return;
    const { item, action } = confirm;
    try {
      if (action === "delete") {
        const res = await fetch(`${API}/api/receivables/${item.id}`, { method: "DELETE" });
        if (!res.ok) throw new Error();
        setReceivables((p) => p.filter((r) => r.id !== item.id));
        addToast("Receivable deleted");
      } else {
        const res = await fetch(`${API}/api/receivables/${item.id}/received`, { method: "PUT" });
        if (!res.ok) throw new Error();
        if (!showReceived) {
          setReceivables((p) => p.filter((r) => r.id !== item.id));
        } else {
          setReceivables((p) => p.map((r) => r.id === item.id ? { ...r, status: "Received" } : r));
        }
        addToast("Marked as received");
      }
    } catch {
      addToast("Operation failed", "error");
    } finally {
      setConfirm(null);
    }
  }

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />
      {confirm && (
        <ConfirmDialog item={confirm.item} action={confirm.action}
          onConfirm={handleConfirm} onCancel={() => setConfirm(null)} />
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
            <StatCard label="Overdue Tenants" value={overdueCount} sub="1+ months behind" color={overdueCount > 0 ? "red" : undefined} />
            <StatCard label="Est. Rent Outstanding" value={PKR(totalEstOutstanding)} sub={totalEstOutstanding === 0 ? "Set rates on Tenants page" : undefined} color={totalEstOutstanding > 0 ? "amber" : undefined} />
            <StatCard label="Pending Receivables" value={pending.length} />
            <StatCard label="Pending Amount" value={PKR(pendingTotal)} color={pendingTotal > 0 ? "amber" : undefined} />
          </>
        )}
      </div>

      {/* ── Tabs ─────────────────────────────────────────────────────────── */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => setTab("arrears")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "arrears" ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <Users className="w-4 h-4" />
          Rent Arrears
          {overdueCount > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-red-100 text-red-700 font-semibold">{overdueCount}</span>
          )}
        </button>
        <button
          onClick={() => setTab("receivables")}
          className={cn(
            "flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors",
            tab === "receivables" ? "border-emerald-500 text-emerald-600" : "border-transparent text-gray-500 hover:text-gray-700"
          )}
        >
          <ClipboardList className="w-4 h-4" />
          General Receivables
          {pending.length > 0 && (
            <span className="ml-1 px-1.5 py-0.5 rounded-full text-xs bg-amber-100 text-amber-700 font-semibold">{pending.length}</span>
          )}
        </button>
      </div>

      {/* ── Rent Arrears Tab ──────────────────────────────────────────────── */}
      {tab === "arrears" && (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          {/* Filters */}
          <div className="flex items-center gap-4 px-6 py-4 border-b border-gray-100">
            <h2 className="text-base font-semibold text-gray-900 flex-1">
              Tenant Rent Arrears
              {!tenantsLoading && <span className="ml-2 text-xs font-normal text-gray-400">({filteredTenants.length} tenants)</span>}
            </h2>
            <select value={spaceFilter} onChange={(e) => setSpaceFilter(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="All">All Spaces</option>
              <option value="SHOP">SHOP</option>
              <option value="FLAT">FLAT</option>
            </select>
            {uniquePlots.length > 1 && (
              <select value={plotFilter} onChange={(e) => setPlotFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                <option value="All">All Plots</option>
                {uniquePlots.map((p) => <option key={p} value={p}>{p}</option>)}
              </select>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tenant</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Space</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Plot</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Last Paid</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Monthly Rate</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Est. Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {tenantsLoading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 7 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : filteredTenants.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                      <Users className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No tenants found</p>
                    </td>
                  </tr>
                ) : (
                  filteredTenants.map((t) => {
                    const badge = arrearsBadge(t.months);
                    const hasRate = (t.monthly_rent || 0) + (t.water_charge || 0) > 0;
                    return (
                      <tr key={t.id} className={cn("transition-colors", rowBg(t.months), "hover:brightness-95")}>
                        <td className="px-4 py-3 font-medium text-gray-900">{t.name}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {t.space_type && t.space_number ? `${t.space_type} ${t.space_number}` : t.space_type || "—"}
                        </td>
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{t.plot_code || "—"}</td>
                        <td className="px-4 py-3 text-gray-600 whitespace-nowrap">
                          {t.last_paid_month && t.last_paid_year
                            ? `${MONTH_NAMES[t.last_paid_month - 1]} ${t.last_paid_year}`
                            : "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-medium", badge.cls)}>
                            {badge.label}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-gray-600">
                          {hasRate
                            ? <span>{PKR((t.monthly_rent || 0) + (t.water_charge || 0))}<span className="text-xs text-gray-400">/mo</span></span>
                            : <span className="text-xs text-gray-400 italic">not set</span>}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold">
                          {t.months !== null && t.months > 0 && hasRate
                            ? <span className="text-red-700">{PKR(t.estOutstanding)}</span>
                            : <span className="text-gray-400">—</span>}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {totalEstOutstanding === 0 && activeTenants.length > 0 && (
            <div className="px-6 py-3 border-t border-gray-100 bg-gray-50">
              <p className="text-xs text-gray-500">
                Monthly rates are not set for most tenants. Go to <strong>Tenants</strong> page to set monthly_rent and water_charge.
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── General Receivables Tab ────────────────────────────────────────── */}
      {tab === "receivables" && (
        <>
          {/* Add Form */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <Inbox className="w-5 h-5 text-emerald-600" />
              <h2 className="text-base font-semibold text-gray-900">Add Receivable</h2>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
                  <input type="date" value={form.date} onChange={set("date")} required
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Receipt / Reference No.</label>
                  <input type="text" value={form.receipt_no} onChange={set("receipt_no")} placeholder="e.g. R-001"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Party Name</label>
                  <input type="text" value={form.party_name} onChange={set("party_name")} placeholder="Name"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Amount (PKR) *</label>
                  <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} required placeholder="0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Particulars</label>
                <input type="text" value={form.particulars} onChange={set("particulars")} placeholder="Description"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </div>
              <div className="flex justify-end">
                <button type="submit" disabled={submitting}
                  className="px-6 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50">
                  {submitting ? "Saving…" : "Add Receivable"}
                </button>
              </div>
            </form>
          </div>

          {/* Table */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <h2 className="text-base font-semibold text-gray-900">
                Receivables
                {!loading && <span className="ml-2 text-xs font-normal text-gray-400">({receivables.length})</span>}
              </h2>
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm text-gray-600 cursor-pointer select-none">
                  <input type="checkbox" checked={showReceived} onChange={(e) => setShowReceived(e.target.checked)}
                    className="rounded border-gray-300 text-emerald-600 focus:ring-emerald-500" />
                  Show received
                </label>
                <a
                  href={`${API}/api/export/receivables?trust_id=${selectedTrust?.id}&status=Pending`}
                  download
                  className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <Download className="w-3.5 h-3.5" /> Export
                </a>
              </div>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-gray-50 border-b border-gray-200">
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Ref No.</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Party</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Particulars</th>
                    <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Status</th>
                    <th className="px-4 py-3" />
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    Array.from({ length: 3 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        {Array.from({ length: 7 }).map((__, j) => (
                          <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                        ))}
                      </tr>
                    ))
                  ) : receivables.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                        <Inbox className="w-10 h-10 mx-auto mb-3 opacity-30" />
                        <p className="font-medium">No receivables found</p>
                      </td>
                    </tr>
                  ) : (
                    receivables.map((r) => (
                      <tr key={r.id} className={cn("hover:bg-gray-50 transition-colors", r.status === "Received" && "opacity-60")}>
                        <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(r.date)}</td>
                        <td className="px-4 py-3 font-mono text-gray-500">{r.receipt_no || "—"}</td>
                        <td className="px-4 py-3 font-medium text-gray-900">{r.party_name || "—"}</td>
                        <td className="px-4 py-3 text-gray-500">{r.particulars || "—"}</td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-900">{PKR(r.amount)}</td>
                        <td className="px-4 py-3">
                          <span className={cn("px-2 py-0.5 rounded text-xs font-medium",
                            r.status === "Pending" ? "bg-amber-100 text-amber-700" : "bg-emerald-100 text-emerald-700")}>
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            {r.status === "Pending" && (
                              <button onClick={() => setConfirm({ item: r, action: "received" })}
                                title="Mark as received"
                                className="p-1.5 rounded-lg text-gray-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors">
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            )}
                            <button onClick={() => setConfirm({ item: r, action: "delete" })}
                              title="Delete"
                              className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
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
        </>
      )}
    </div>
  );
}
