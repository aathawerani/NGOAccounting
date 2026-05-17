import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Search, ShieldCheck, Loader2, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000/api";
const PAGE_SIZE = 50;

const ACTION_STYLES = {
  create: "bg-emerald-100 text-emerald-700",
  update: "bg-blue-100 text-blue-700",
  delete: "bg-red-100 text-red-600",
};

const TABLE_LABELS = {
  vouchers:      "Vouchers",
  rent_receipts: "Rent Receipts",
  tenants:       "Tenants",
  investments:   "Investments",
};

function fmtTs(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("en-GB", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

export default function AuditLogPage() {
  const { selectedTrust } = useTrust();

  const [rows, setRows]       = useState([]);
  const [total, setTotal]     = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const [page, setPage]       = useState(0);

  const [filterTable,  setFilterTable]  = useState("");
  const [filterAction, setFilterAction] = useState("");
  const [search, setSearch]             = useState("");

  const fetch_ = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true); setError(null);
    const params = new URLSearchParams({
      trust_id: selectedTrust.id,
      limit: PAGE_SIZE,
      offset: page * PAGE_SIZE,
    });
    if (filterTable)  params.set("table",  filterTable);
    if (filterAction) params.set("action", filterAction);
    try {
      const res = await fetch(`${API}/audit-log?${params}`);
      if (!res.ok) throw new Error("Failed to load audit log");
      const data = await res.json();
      setRows(data.rows ?? []);
      setTotal(data.total ?? 0);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTrust, page, filterTable, filterAction]);

  useEffect(() => { setPage(0); }, [selectedTrust, filterTable, filterAction]);
  useEffect(() => { fetch_(); }, [fetch_]);

  const filtered = search
    ? rows.filter(r =>
        (r.description ?? "").toLowerCase().includes(search.toLowerCase()) ||
        (r.table_name  ?? "").toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center">
            <ShieldCheck className="w-5 h-5 text-slate-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900">Audit Log</h1>
            <p className="text-xs text-gray-400">All create / update / delete operations</p>
          </div>
        </div>
        {!loading && (
          <span className="text-xs text-gray-400 font-medium">{total.toLocaleString()} total entries</span>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-4 py-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          <input
            type="text"
            placeholder="Search description…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-500 focus:border-transparent placeholder:text-gray-400"
          />
        </div>

        {/* Table filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {[["", "All Tables"], ...Object.entries(TABLE_LABELS)].map(([val, label]) => (
            <button key={val} onClick={() => setFilterTable(val)}
              className={cn("px-3 py-2 font-medium transition-colors",
                filterTable === val ? "bg-slate-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
              {label}
            </button>
          ))}
        </div>

        {/* Action filter */}
        <div className="flex rounded-lg border border-gray-200 overflow-hidden text-xs">
          {[["", "All"], ["create", "Create"], ["update", "Update"], ["delete", "Delete"]].map(([val, label]) => (
            <button key={val} onClick={() => setFilterAction(val)}
              className={cn("px-3 py-2 font-medium transition-colors",
                filterAction === val ? "bg-slate-800 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-7 h-7 text-slate-400 animate-spin" />
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <AlertTriangle className="w-8 h-8 text-red-400 mb-2" />
            <p className="text-sm text-red-600">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <ShieldCheck className="w-10 h-10 text-gray-200 mb-3" />
            <p className="text-sm font-medium text-gray-500">No audit entries yet</p>
            <p className="text-xs text-gray-400 mt-1">Actions will appear here as you create, edit, or delete records</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-100">
                  {["Timestamp", "Action", "Table", "Record ID", "Description"].map((h, i) => (
                    <th key={h} className={cn(
                      "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap",
                      i === 2 || i === 3 ? "text-center" : "text-left"
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(r => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition-colors">
                    <td className="px-4 py-2.5 text-gray-500 whitespace-nowrap text-xs font-mono">
                      {fmtTs(r.timestamp)}
                    </td>
                    <td className="px-4 py-2.5">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold capitalize",
                        ACTION_STYLES[r.action] ?? "bg-gray-100 text-gray-600"
                      )}>
                        {r.action}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center">
                      <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                        {TABLE_LABELS[r.table_name] ?? r.table_name}
                      </span>
                    </td>
                    <td className="px-4 py-2.5 text-center text-xs text-gray-400 font-mono">
                      {r.record_id ?? "—"}
                    </td>
                    <td className="px-4 py-2.5 text-gray-700 truncate max-w-xs">{r.description || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100">
            <p className="text-xs text-gray-400">
              Page {page + 1} of {totalPages} · {total.toLocaleString()} total
            </p>
            <div className="flex items-center gap-2">
              <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page >= totalPages - 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 text-gray-500 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
