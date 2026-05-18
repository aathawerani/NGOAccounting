import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { AlertCircle, CheckCircle2, X } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const fmtDate = (iso) => {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
};

const STATUS_STYLE = {
  SHORT:   "bg-amber-100 text-amber-700",
  ADVANCE: "bg-gray-100 text-gray-500",
};

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={cn("bg-white rounded-xl border shadow-sm p-4", accent ? "border-amber-300" : "border-gray-200")}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold", accent ? "text-amber-700" : "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

function CollectModal({ item, type, onClose, onCollected }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const shortfall = item.shortfall ?? Math.max(0, (item.total_amount || 0) - (item.cash_received || 0));
  const label = type === "rent" ? `${item.tenant_name || "Tenant"} — Receipt #${item.serial_no}` : `${item.event_name || "Majlis"} — Bill #${item.serial_no}`;

  async function submit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter a valid amount."); return; }
    if (amt > shortfall + 0.005) { setErr(`Amount exceeds balance due (${PKR(shortfall)}).`); return; }
    setSaving(true);
    const url = type === "rent"
      ? `${API}/api/rent/${item.id}/collect`
      : `${API}/api/majlis/${item.id}/collect`;
    try {
      const res = await fetch(url, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cash_received: amt }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      onCollected(await res.json());
    } catch (ex) {
      setErr(ex.message);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="font-semibold text-gray-900">Collect Payment</h3>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        <div className="bg-gray-50 rounded-lg p-3 mb-4 space-y-1 text-sm">
          <div className="flex justify-between"><span className="text-gray-500">Total Bill</span><span className="font-medium">{PKR(item.total_amount)}</span></div>
          <div className="flex justify-between"><span className="text-gray-500">Previously Received</span><span className="font-medium text-emerald-700">{PKR(item.cash_received ?? 0)}</span></div>
          <div className="flex justify-between border-t border-gray-200 pt-1"><span className="text-gray-700 font-medium">Balance Due</span><span className="font-bold text-amber-700">{PKR(shortfall)}</span></div>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount Received (PKR)</label>
            <input
              type="number" min="0.01" step="0.01" max={shortfall}
              value={amount} onChange={e => { setAmount(e.target.value); setErr(""); }}
              placeholder={String(shortfall)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus
            />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving} className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Saving…" : "Record Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function CashReceivablesPage() {
  const { selectedTrust } = useTrust();
  const [tab, setTab] = useState("rent");
  const [filter, setFilter] = useState("ALL");
  const [rentItems, setRentItems] = useState([]);
  const [majlisItems, setMajlisItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collectTarget, setCollectTarget] = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3000);
  };

  const fetchAll = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const [rRes, mRes] = await Promise.all([
        fetch(`${API}/api/rent/receivables?trust_id=${selectedTrust.id}`),
        fetch(`${API}/api/majlis/receivables?trust_id=${selectedTrust.id}`),
      ]);
      if (rRes.ok) setRentItems(await rRes.json());
      if (mRes.ok) setMajlisItems(await mRes.json());
    } catch {
      showToast("Failed to load receivables", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function handleCollected(updated) {
    if (collectTarget?.type === "rent") {
      setRentItems(prev => {
        const next = prev.map(r => r.id === updated.id ? updated : r);
        return next.filter(r => ["SHORT", "ADVANCE"].includes(r.cash_status));
      });
    } else {
      setMajlisItems(prev => {
        const next = prev.map(b => b.id === updated.id ? updated : b);
        return next.filter(b => ["SHORT", "ADVANCE"].includes(b.cash_status));
      });
    }
    showToast("Payment recorded successfully");
    setCollectTarget(null);
  }

  const rentFiltered  = filter === "ALL" ? rentItems  : rentItems.filter(r => r.cash_status === filter);
  const majlisFiltered = filter === "ALL" ? majlisItems : majlisItems.filter(b => b.cash_status === filter);

  const rentOutstanding  = rentItems.reduce((s, r) => s + (r.shortfall ?? 0), 0);
  const majlisOutstanding = majlisItems.reduce((s, b) => s + (b.shortfall ?? 0), 0);

  const items    = tab === "rent" ? rentFiltered : majlisFiltered;
  const isRent   = tab === "rent";

  return (
    <div className="space-y-6">
      {/* Toast */}
      {toast && (
        <div className={cn(
          "fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg text-sm font-medium",
          toast.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        )}>
          {toast.msg}
        </div>
      )}

      {collectTarget && (
        <CollectModal
          item={collectTarget.item}
          type={collectTarget.type}
          onClose={() => setCollectTarget(null)}
          onCollected={handleCollected}
        />
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {loading ? (
          Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" /><div className="h-7 bg-gray-200 rounded w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Rent Outstanding" value={PKR(rentOutstanding)} sub={`${rentItems.length} receipt(s)`} accent={rentOutstanding > 0} />
            <StatCard label="Majlis Outstanding" value={PKR(majlisOutstanding)} sub={`${majlisItems.length} bill(s)`} accent={majlisOutstanding > 0} />
            <StatCard label="Grand Total Due" value={PKR(rentOutstanding + majlisOutstanding)} sub={`${rentItems.length + majlisItems.length} item(s)`} accent={(rentOutstanding + majlisOutstanding) > 0} />
          </>
        )}
      </div>

      {/* Tabs + Filter */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[["rent", "Rent Receipts"], ["majlis", "Majlis Bills"]].map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}
              >
                {label}
                <span className={cn(
                  "ml-1.5 inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold",
                  tab === id ? "bg-amber-100 text-amber-700" : "bg-gray-200 text-gray-500"
                )}>
                  {id === "rent" ? rentItems.length : majlisItems.length}
                </span>
              </button>
            ))}
          </div>

          {/* Filter */}
          <div className="flex gap-1">
            {["ALL", "SHORT", "ADVANCE"].map(f => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                  filter === f
                    ? f === "SHORT" ? "bg-amber-100 border-amber-300 text-amber-700"
                      : f === "ADVANCE" ? "bg-gray-100 border-gray-400 text-gray-600"
                      : "bg-slate-800 border-slate-800 text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}
              >
                {f}
              </button>
            ))}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Date</th>
                {isRent ? (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Tenant</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Space</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Period</th>
                  </>
                ) : (
                  <>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Event / Donor</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Hijri Date</th>
                  </>
                )}
                <th className="px-4 py-3 text-right font-medium text-gray-600">Total Bill</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Cash Received</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600">Balance Due</th>
                <th className="px-4 py-3 text-center font-medium text-gray-600">Status</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: isRent ? 10 : 9 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : items.length === 0 ? (
                <tr>
                  <td colSpan={isRent ? 10 : 9} className="px-6 py-12 text-center">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
                    <p className="font-medium text-gray-500">No outstanding payments</p>
                    <p className="text-xs text-gray-400 mt-1">All {isRent ? "rent receipts" : "majlis bills"} are fully paid.</p>
                  </td>
                </tr>
              ) : (
                items.map((item) => {
                  const shortfall = item.shortfall ?? Math.max(0, (item.total_amount || 0) - (item.cash_received || 0));
                  return (
                    <tr key={item.id} className="hover:bg-amber-50/40 transition-colors">
                      <td className="px-4 py-3 font-mono text-gray-500">{item.serial_no}</td>
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(item.date)}</td>
                      {isRent ? (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.tenant_name || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">{item.space_type} {item.space_number}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {item.from_date && item.to_date
                              ? `${fmtDate(item.from_date)} – ${fmtDate(item.to_date)}`
                              : "—"}
                          </td>
                        </>
                      ) : (
                        <>
                          <td className="px-4 py-3 font-medium text-gray-900">{item.event_name || "—"}</td>
                          <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                            {item.hijri_day && item.hijri_month
                              ? `${item.hijri_day} ${item.hijri_month} ${item.hijri_year ?? ""}`
                              : "—"}
                          </td>
                        </>
                      )}
                      <td className="px-4 py-3 text-right font-semibold text-gray-900">{PKR(item.total_amount)}</td>
                      <td className="px-4 py-3 text-right text-emerald-700">{PKR(item.cash_received ?? 0)}</td>
                      <td className="px-4 py-3 text-right font-semibold text-red-600">{PKR(shortfall)}</td>
                      <td className="px-4 py-3 text-center">
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-semibold", STATUS_STYLE[item.cash_status] ?? "bg-gray-100 text-gray-500")}>
                          {item.cash_status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setCollectTarget({ item, type: tab })}
                          className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap"
                        >
                          Collect
                        </button>
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
