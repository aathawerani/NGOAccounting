import { useState, useEffect, useRef, useCallback } from "react";
import { Calendar, ChevronDown, Menu, Search, X, Loader2 } from "lucide-react";
import { useTrust } from "../context/TrustContext";

const API = "http://localhost:8000";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  "rent-entry": "Rent Entry",
  tenants: "Tenants",
  "majlis-bills": "Majlis Bills",
  vouchers: "Vouchers",
  "journal-entries": "Journal Entries",
  investments: "Investments",
  "cash-position": "Cash Position",
  receivables: "Receivables",
  "import-excel": "Import Excel",
  "export-reports": "Export Reports",
  "financial-reports": "Financial Reports",
  "fiscal-year-close": "Fiscal Year Close",
};

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SearchBar({ selectedTrust }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const timerRef = useRef(null);
  const inputRef = useRef(null);
  const containerRef = useRef(null);

  const doSearch = useCallback(async (q) => {
    if (!selectedTrust || !q.trim()) { setResults(null); return; }
    setLoading(true);
    try {
      const res = await fetch(
        `${API}/api/search?trust_id=${selectedTrust.id}&q=${encodeURIComponent(q)}&limit=20`
      );
      const json = await res.json();
      setResults(json.results);
    } catch { setResults([]); }
    finally { setLoading(false); }
  }, [selectedTrust]);

  useEffect(() => {
    clearTimeout(timerRef.current);
    if (!query.trim()) { setResults(null); return; }
    timerRef.current = setTimeout(() => doSearch(query), 300);
    return () => clearTimeout(timerRef.current);
  }, [query, doSearch]);

  // Close dropdown on outside click
  useEffect(() => {
    function onClick(e) {
      if (containerRef.current && !containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  function clear() { setQuery(""); setResults(null); setOpen(false); }

  const showDropdown = open && (loading || (results && results.length > 0) || (results && results.length === 0 && query.trim()));

  return (
    <div ref={containerRef} className="relative hidden md:block">
      <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5 w-64 focus-within:border-blue-400 focus-within:ring-1 focus-within:ring-blue-300 transition-all">
        <Search className="w-4 h-4 text-gray-400 shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); }}
          onFocus={() => { if (query.trim()) setOpen(true); }}
          placeholder="Search entries…"
          className="flex-1 bg-transparent text-sm text-gray-700 placeholder:text-gray-400 outline-none min-w-0"
        />
        {loading && <Loader2 className="w-3.5 h-3.5 text-gray-400 animate-spin shrink-0" />}
        {!loading && query && (
          <button onClick={clear} className="text-gray-400 hover:text-gray-600">
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>

      {showDropdown && (
        <div className="absolute top-full mt-1 left-0 w-[440px] bg-white rounded-xl shadow-xl border border-gray-200 z-50 overflow-hidden">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-6 text-sm text-gray-400">
              <Loader2 className="w-4 h-4 animate-spin" /> Searching…
            </div>
          ) : results?.length === 0 ? (
            <div className="py-6 text-center text-sm text-gray-400">
              No results for <span className="font-medium text-gray-600">"{query}"</span>
            </div>
          ) : (
            <>
              <div className="px-3 py-2 border-b border-gray-100 flex items-center justify-between">
                <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {results.length} result{results.length !== 1 ? "s" : ""}
                </span>
                <span className="text-xs text-gray-400">{selectedTrust?.code}</span>
              </div>
              <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
                {results.map((r) => (
                  <div key={r.id} className="px-3 py-2.5 hover:bg-gray-50 cursor-default">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <p className="text-xs text-gray-400 mb-0.5">{fmtDate(r.date)}</p>
                        <p className="text-sm text-gray-800 truncate">{r.particulars || r.party_name || "—"}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">
                          {r.account_code}
                          {r.contra_account_code ? ` ↔ ${r.contra_account_code}` : ""}
                          {r.receipt_no ? ` · #${r.receipt_no}` : ""}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        {r.debit > 0 && (
                          <p className="text-xs font-semibold text-emerald-700">DR {PKR(r.debit)}</p>
                        )}
                        {r.credit > 0 && (
                          <p className="text-xs font-semibold text-red-600">CR {PKR(r.credit)}</p>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default function TopBar({ activePage, onMenuToggle }) {
  const { trusts, selectedTrust, setSelectedTrust, currentDate } = useTrust();

  function handleTrustChange(e) {
    const trust = trusts.find((t) => t.id === parseInt(e.target.value));
    if (trust) setSelectedTrust(trust);
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 flex-shrink-0 shadow-sm gap-4">
      {/* Hamburger + page title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors shrink-0"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-800 truncate hidden sm:block">
          {PAGE_TITLES[activePage] ?? "Dashboard"}
        </h1>
      </div>

      {/* Global search */}
      <SearchBar selectedTrust={selectedTrust} />

      {/* Right controls */}
      <div className="flex items-center gap-5 shrink-0">
        {/* Date display — hidden on narrow windows */}
        <div className="hidden lg:flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-700 leading-tight">
              {currentDate.gregorian_formatted || "—"}
            </p>
            {currentDate.hijri_formatted && (
              <p className="text-xs text-gray-400 leading-tight">
                {currentDate.hijri_formatted}
              </p>
            )}
          </div>
        </div>

        <div className="hidden lg:block h-8 w-px bg-gray-200" />

        {/* Trust selector */}
        <div className="relative flex items-center">
          <select
            value={selectedTrust?.id ?? ""}
            onChange={handleTrustChange}
            className="appearance-none bg-slate-900 text-white text-sm font-semibold pl-4 pr-9 py-2 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors hover:bg-slate-800"
          >
            {trusts.map((trust) => (
              <option key={trust.id} value={trust.id}>
                {trust.code}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
        </div>
      </div>
    </header>
  );
}
