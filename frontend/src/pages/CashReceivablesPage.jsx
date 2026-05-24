import { useState, useEffect, useCallback, useRef } from "react";
import { useTrust } from "../context/TrustContext";
import { CheckCircle2, X, Users, Printer } from "lucide-react";
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

// ── Toast ─────────────────────────────────────────────────────────────────────
function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => (
        <div key={t.id} className={cn(
          "px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto transition-all",
          t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

// ── Single-receipt collect modal ──────────────────────────────────────────────
function CollectModal({ item, type, onClose, onCollected }) {
  const [amount, setAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const shortfall = item.shortfall ?? Math.max(0, (item.total_amount || 0) - (item.cash_received || 0));
  const name = type === "rent" ? item.tenant_name || "Tenant" : item.event_name || "Majlis";
  const label = type === "rent"
    ? `${name} — Receipt #${item.serial_no}`
    : `${name} — Bill #${item.serial_no}`;

  async function submit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) { setErr("Enter a valid amount."); return; }
    if (amt > shortfall + 0.005) { setErr(`Exceeds balance due (${PKR(shortfall)}).`); return; }
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
      onCollected(await res.json(), { amount: amt, name });
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
            <input type="number" min="0.01" step="0.01" max={shortfall}
              value={amount} onChange={e => { setAmount(e.target.value); setErr(""); }}
              placeholder={String(shortfall)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus />
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 justify-end pt-1">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Saving…" : "Record Collection"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Collect-All modal ─────────────────────────────────────────────────────────
function CollectAllModal({ items, type, groupName, onClose, onAllCollected }) {
  const sorted = [...items].sort((a, b) => new Date(a.date) - new Date(b.date));
  const [checked, setChecked] = useState(() => new Set(sorted.map(i => i.id)));
  const [totalAmt, setTotalAmt] = useState("");
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState("");

  const checkedItems = sorted.filter(i => checked.has(i.id));
  const totalShortfall = checkedItems.reduce((s, i) => s + (i.shortfall ?? 0), 0);

  function toggleAll() {
    if (checked.size === sorted.length) setChecked(new Set());
    else setChecked(new Set(sorted.map(i => i.id)));
  }

  async function submit(e) {
    e.preventDefault();
    const amt = parseFloat(totalAmt);
    if (!checkedItems.length) { setErr("Select at least one receipt."); return; }
    if (!amt || amt <= 0) { setErr("Enter a valid total amount."); return; }
    if (amt > totalShortfall + 0.005) { setErr(`Exceeds total balance due (${PKR(totalShortfall)}).`); return; }

    setSaving(true);
    // Distribute oldest-first
    let remaining = amt;
    const results = [];
    try {
      for (const item of checkedItems) {
        if (remaining <= 0) break;
        const allocate = Math.min(remaining, item.shortfall ?? 0);
        if (allocate <= 0) continue;
        const url = type === "rent"
          ? `${API}/api/rent/${item.id}/collect`
          : `${API}/api/majlis/${item.id}/collect`;
        const res = await fetch(url, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cash_received: allocate }),
        });
        if (!res.ok) throw new Error(`Receipt #${item.serial_no}: ${(await res.json()).detail ?? "Failed"}`);
        results.push(await res.json());
        remaining -= allocate;
      }
      onAllCollected(results, { amount: amt, name: groupName, count: results.length });
    } catch (ex) {
      setErr(ex.message);
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-lg mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between mb-4 flex-shrink-0">
          <div>
            <h3 className="font-semibold text-gray-900">Collect All Outstanding</h3>
            <p className="text-xs text-gray-500 mt-0.5">{groupName}</p>
          </div>
          <button onClick={onClose} className="p-1 rounded hover:bg-gray-100"><X className="w-4 h-4" /></button>
        </div>

        {/* Receipts checklist */}
        <div className="flex-1 overflow-y-auto mb-4 border border-gray-200 rounded-lg">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                <th className="px-3 py-2 text-left">
                  <input type="checkbox" checked={checked.size === sorted.length}
                    onChange={toggleAll} className="w-4 h-4 accent-emerald-500" />
                </th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">#</th>
                <th className="px-3 py-2 text-left font-medium text-gray-600">Date</th>
                <th className="px-3 py-2 text-right font-medium text-gray-600">Balance Due</th>
                <th className="px-3 py-2 text-center font-medium text-gray-600">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sorted.map(item => (
                <tr key={item.id} className={cn("transition-colors", checked.has(item.id) ? "bg-emerald-50/40" : "")}>
                  <td className="px-3 py-2">
                    <input type="checkbox" checked={checked.has(item.id)}
                      onChange={() => setChecked(prev => {
                        const next = new Set(prev);
                        next.has(item.id) ? next.delete(item.id) : next.add(item.id);
                        return next;
                      })}
                      className="w-4 h-4 accent-emerald-500" />
                  </td>
                  <td className="px-3 py-2 font-mono text-gray-500">{item.serial_no}</td>
                  <td className="px-3 py-2 text-gray-700">{fmtDate(item.date)}</td>
                  <td className="px-3 py-2 text-right font-semibold text-red-600">{PKR(item.shortfall ?? 0)}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold", STATUS_STYLE[item.cash_status] ?? "")}>
                      {item.cash_status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Total input */}
        <form onSubmit={submit} className="space-y-3 flex-shrink-0">
          <div className="flex items-center justify-between text-sm bg-amber-50 rounded-lg px-4 py-2.5 border border-amber-200">
            <span className="text-amber-800 font-medium">Total Balance Due ({checkedItems.length} selected)</span>
            <span className="font-bold text-amber-700">{PKR(totalShortfall)}</span>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Total Cash Received (PKR)</label>
            <input type="number" min="0.01" step="0.01" max={totalShortfall}
              value={totalAmt} onChange={e => { setTotalAmt(e.target.value); setErr(""); }}
              placeholder={String(totalShortfall)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
              autoFocus />
            <p className="text-xs text-gray-400 mt-1">Amount will be distributed oldest receipt first.</p>
          </div>
          {err && <p className="text-xs text-red-600">{err}</p>}
          <div className="flex gap-3 justify-end">
            <button type="button" onClick={onClose}
              className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
            <button type="submit" disabled={saving || !checkedItems.length}
              className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50">
              {saving ? "Recording…" : `Collect ${PKR(parseFloat(totalAmt) || totalShortfall)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Stat card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, sub, accent }) {
  return (
    <div className={cn("bg-white rounded-xl border shadow-sm p-4", accent ? "border-amber-300" : "border-gray-200")}>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className={cn("text-xl font-bold", accent ? "text-amber-700" : "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export default function CashReceivablesPage() {
  const { selectedTrust } = useTrust();
  const [tab, setTab] = useState("rent");
  const [filter, setFilter] = useState("ALL");
  const [rentItems, setRentItems] = useState([]);
  const [majlisItems, setMajlisItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [collectTarget, setCollectTarget] = useState(null);
  const [collectAllTarget, setCollectAllTarget] = useState(null);
  const [fadingIds, setFadingIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);
  const fadeTimers = useRef({});

  function addToast(msg, type = "success") {
    const id = Date.now();
    setToasts(p => [...p, { id, msg, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 4000);
  }

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
      addToast("Failed to load receivables", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Fade then remove a single item
  function fadeOutItem(id, isRent) {
    setFadingIds(prev => new Set([...prev, id]));
    fadeTimers.current[id] = setTimeout(() => {
      setFadingIds(prev => { const n = new Set(prev); n.delete(id); return n; });
      if (isRent) {
        setRentItems(prev => prev.filter(r => r.id !== id));
      } else {
        setMajlisItems(prev => prev.filter(b => b.id !== id));
      }
      delete fadeTimers.current[id];
    }, 500);
  }

  function handleCollected(updated, { amount, name }) {
    const isRent = collectTarget?.type === "rent";
    addToast(`${PKR(amount)} collected from ${name}`);
    if (updated.cash_status === "PAID") {
      // Update in place first, then fade out
      if (isRent) setRentItems(prev => prev.map(r => r.id === updated.id ? updated : r));
      else setMajlisItems(prev => prev.map(b => b.id === updated.id ? updated : b));
      fadeOutItem(updated.id, isRent);
    } else {
      if (isRent) setRentItems(prev => prev.map(r => r.id === updated.id ? updated : r));
      else setMajlisItems(prev => prev.map(b => b.id === updated.id ? updated : b));
    }
    setCollectTarget(null);
  }

  function handleAllCollected(results, { amount, name, count }) {
    const isRent = collectAllTarget?.type === "rent";
    addToast(`${PKR(amount)} collected from ${name} across ${count} receipt(s)`);
    const updatedById = Object.fromEntries(results.map(r => [r.id, r]));
    const setter = isRent ? setRentItems : setMajlisItems;
    setter(prev => prev.map(item => updatedById[item.id] ? updatedById[item.id] : item));
    results.filter(r => r.cash_status === "PAID").forEach(r => fadeOutItem(r.id, isRent));
    setCollectAllTarget(null);
  }

  // Grouping
  function groupBy(items, keyFn) {
    const map = new Map();
    for (const item of items) {
      const k = keyFn(item) || "—";
      if (!map.has(k)) map.set(k, []);
      map.get(k).push(item);
    }
    return map;
  }

  const rentFiltered   = filter === "ALL" ? rentItems   : rentItems.filter(r => r.cash_status === filter);
  const majlisFiltered = filter === "ALL" ? majlisItems : majlisItems.filter(b => b.cash_status === filter);

  const rentGroups   = groupBy(rentFiltered,   i => i.tenant_name);
  const majlisGroups = groupBy(majlisFiltered, i => i.event_name);

  const rentOutstanding   = rentItems.reduce((s, r) => s + (r.shortfall ?? 0), 0);
  const majlisOutstanding = majlisItems.reduce((s, b) => s + (b.shortfall ?? 0), 0);

  const isRent   = tab === "rent";
  const groups   = isRent ? rentGroups : majlisGroups;
  const totalCols = isRent ? 10 : 9;

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />

      {collectTarget && (
        <CollectModal
          item={collectTarget.item}
          type={collectTarget.type}
          onClose={() => setCollectTarget(null)}
          onCollected={handleCollected}
        />
      )}
      {collectAllTarget && (
        <CollectAllModal
          items={collectAllTarget.items}
          type={collectAllTarget.type}
          groupName={collectAllTarget.name}
          onClose={() => setCollectAllTarget(null)}
          onAllCollected={handleAllCollected}
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

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1">
            {[["rent", "Rent Receipts"], ["majlis", "Majlis Bills"]].map(([id, lbl]) => (
              <button key={id} onClick={() => setTab(id)}
                className={cn(
                  "px-4 py-1.5 rounded-md text-sm font-medium transition-colors",
                  tab === id ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                )}>
                {lbl}
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
              <button key={f} onClick={() => setFilter(f)}
                className={cn(
                  "px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors",
                  filter === f
                    ? f === "SHORT" ? "bg-amber-100 border-amber-300 text-amber-700"
                      : f === "ADVANCE" ? "bg-gray-100 border-gray-400 text-gray-600"
                      : "bg-slate-800 border-slate-800 text-white"
                    : "border-gray-200 text-gray-500 hover:border-gray-300"
                )}>
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
                    {Array.from({ length: totalCols }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : groups.size === 0 ? (
                <tr>
                  <td colSpan={totalCols} className="px-6 py-12 text-center">
                    <CheckCircle2 className="w-10 h-10 mx-auto mb-3 text-emerald-400 opacity-60" />
                    <p className="font-medium text-gray-500">No outstanding payments</p>
                    <p className="text-xs text-gray-400 mt-1">All {isRent ? "rent receipts" : "majlis bills"} are fully paid.</p>
                  </td>
                </tr>
              ) : (
                Array.from(groups.entries()).map(([groupKey, groupItems]) => {
                  const groupShortfall = groupItems.reduce((s, i) => s + (i.shortfall ?? 0), 0);
                  return [
                    // Group header row
                    <tr key={`grp-${groupKey}`} className="bg-amber-50/60 border-b border-amber-100">
                      <td colSpan={isRent ? 5 : 4} className="px-4 py-2.5">
                        <div className="flex items-center gap-2">
                          <Users className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                          <span className="font-semibold text-gray-800 text-xs">{groupKey}</span>
                          <span className="text-xs text-gray-400">({groupItems.length} receipt{groupItems.length !== 1 ? "s" : ""})</span>
                        </div>
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">
                        <span className="font-bold text-red-600 text-xs">{PKR(groupShortfall)}</span>
                      </td>
                      <td className="px-4 py-2.5" />
                      <td className="px-4 py-2.5 text-right">
                        {groupItems.length > 1 && (
                          <button
                            onClick={() => setCollectAllTarget({
                              items: groupItems,
                              type: tab,
                              name: groupKey,
                            })}
                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-500 text-white text-xs font-semibold hover:bg-amber-600 transition-colors whitespace-nowrap"
                          >
                            Collect All
                          </button>
                        )}
                      </td>
                    </tr>,
                    // Individual receipt rows
                    ...groupItems.map(item => {
                      const shortfall = item.shortfall ?? Math.max(0, (item.total_amount || 0) - (item.cash_received || 0));
                      const fading = fadingIds.has(item.id);
                      return (
                        <tr key={item.id}
                          className={cn(
                            "transition-all duration-500 hover:bg-amber-50/40",
                            fading ? "opacity-0 scale-y-95" : "opacity-100"
                          )}>
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
                            <div className="flex items-center justify-end gap-1.5">
                              {isRent && (
                                <a
                                  href={`${API}/api/rent/receipt/${item.id}/pdf`}
                                  target="_blank" rel="noreferrer"
                                  title="Reprint receipt with current status"
                                  className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                                >
                                  <Printer className="w-3.5 h-3.5" />
                                </a>
                              )}
                              <button
                                onClick={() => setCollectTarget({ item, type: tab })}
                                className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-medium hover:bg-emerald-700 transition-colors whitespace-nowrap"
                              >
                                Collect
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    }),
                  ];
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
