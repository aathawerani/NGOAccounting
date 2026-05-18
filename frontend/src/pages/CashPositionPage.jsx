import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw, Wallet, BarChart2, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const CASH_CODES = new Set(["CASH", "BANK", "BOX"]);
const isCashAccount = (code) => CASH_CODES.has(code) || code.startsWith("BANK");

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function BigCard({ label, value, sub, icon: Icon, colorClass }) {
  return (
    <div className={cn("rounded-xl border p-5 flex flex-col gap-2", colorClass)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider opacity-70">{label}</p>
        {Icon && <Icon className="w-5 h-5 opacity-50" />}
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs opacity-60">{sub}</p>}
    </div>
  );
}

function TrustColumn({ trust }) {
  const { trust_name, trust_code, physical_cash, total_receivables, on_account, book_income } = trust;
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-gray-100">
        <span className="inline-block px-2 py-0.5 rounded bg-slate-800 text-white text-xs font-bold">{trust_code}</span>
        <span className="text-sm font-medium text-gray-700 truncate">{trust_name}</span>
      </div>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-gray-500">Physical Cash</span><span className="font-semibold text-emerald-700">{PKR(physical_cash)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">Receivables</span><span className="font-semibold text-amber-700">{PKR(total_receivables)}</span></div>
        <div className="flex justify-between"><span className="text-gray-500">On-Account</span><span className="font-semibold text-blue-700">{PKR(on_account)}</span></div>
        <div className="flex justify-between border-t border-gray-100 pt-2"><span className="text-gray-600 font-medium">Book Income</span><span className="font-bold text-gray-900">{PKR(book_income)}</span></div>
      </div>
    </div>
  );
}

export default function CashPositionPage() {
  const { selectedTrust } = useTrust();
  const [pos, setPos] = useState(null);
  const [allTrusts, setAllTrusts] = useState([]);
  const [cashAccounts, setCashAccounts] = useState([]);
  const [recentEntries, setRecentEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    setError(null);
    try {
      const [posRes, allRes, typesRes, allTrustsRes] = await Promise.all([
        fetch(`${API}/api/cash-position?trust_id=${selectedTrust.id}`),
        fetch(`${API}/api/cash-position/all-trusts`),
        fetch(`${API}/api/accounts/types?trust_id=${selectedTrust.id}`),
        Promise.resolve(null), // placeholder
      ]);

      if (posRes.ok) setPos(await posRes.json());
      if (allRes.ok) setAllTrusts(await allRes.json());

      // Load recent transactions from ledger (same as before)
      if (typesRes.ok) {
        const types = await typesRes.json();
        const liquid = types.filter(a => a.account_type === "ASSET" && isCashAccount(a.account_code));
        const ledgers = await Promise.all(
          liquid.map(async (a) => {
            try {
              const r = await fetch(`${API}/api/accounts/ledger?trust_id=${selectedTrust.id}&account_code=${encodeURIComponent(a.account_code)}`);
              return r.ok ? { ...a, ledger: await r.json() } : { ...a, ledger: null };
            } catch { return { ...a, ledger: null }; }
          })
        );
        setCashAccounts(ledgers);
        const entries = ledgers
          .flatMap(a => (a.ledger?.entries ?? []).map(e => ({ ...e, source: a.account_code })))
          .sort((a, b) => new Date(b.date) - new Date(a.date))
          .slice(0, 25);
        setRecentEntries(entries);
      }
    } catch (err) {
      setError(err.message ?? "Failed to load cash position");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  useEffect(() => { load(); }, [load]);

  const rb = pos?.receivables_breakdown ?? {};

  return (
    <div className="space-y-6">
      {/* ── Primary summary cards ──────────────────────────────────────────── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-28 bg-gray-200 rounded-xl animate-pulse" />
          ))
        ) : (
          <>
            <BigCard
              label="Physical Cash"
              value={PKR(pos?.physical_cash ?? 0)}
              sub={`${cashAccounts.length} account(s)`}
              icon={Wallet}
              colorClass="bg-emerald-50 border-emerald-200 text-emerald-900"
            />
            <BigCard
              label="Total Receivables"
              value={PKR(pos?.total_receivables ?? 0)}
              sub="Outstanding SHORT receipts"
              icon={ArrowDownLeft}
              colorClass="bg-amber-50 border-amber-300 text-amber-900"
            />
            <BigCard
              label="On-Account Advances"
              value={PKR(pos?.on_account ?? 0)}
              sub="Cash received, service pending"
              icon={ArrowUpRight}
              colorClass="bg-blue-50 border-blue-200 text-blue-900"
            />
            <BigCard
              label="Book Income"
              value={PKR(pos?.book_income ?? 0)}
              sub="Total net income (all time)"
              icon={BarChart2}
              colorClass="bg-slate-800 border-slate-700 text-white"
            />
          </>
        )}
      </div>

      {/* ── Per-account cash breakdown + receivables breakdown ─────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Cash accounts */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <Wallet className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-semibold text-gray-800">Cash & Bank Accounts</h3>
          </div>
          <div className="p-4 space-y-2">
            {loading ? (
              Array.from({ length: 3 }).map((_, i) => <div key={i} className="h-10 bg-gray-100 rounded-lg animate-pulse" />)
            ) : pos?.cash_accounts?.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No cash accounts found.</p>
            ) : (
              (pos?.cash_accounts ?? []).map(a => (
                <div key={a.code} className="flex items-center justify-between px-3 py-2.5 rounded-lg bg-gray-50 hover:bg-emerald-50 transition-colors">
                  <div>
                    <span className="font-mono text-xs font-bold text-gray-600 mr-2">{a.code}</span>
                    <span className="text-sm text-gray-700">{a.name}</span>
                  </div>
                  <span className={cn("font-semibold text-sm", a.balance >= 0 ? "text-emerald-700" : "text-red-600")}>
                    {PKR(Math.abs(a.balance))}{a.balance < 0 ? " CR" : ""}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Receivables breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
          <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-2">
            <ArrowDownLeft className="w-4 h-4 text-amber-600" />
            <h3 className="text-sm font-semibold text-gray-800">Receivables Breakdown</h3>
          </div>
          <div className="p-4">
            {loading ? (
              <div className="h-32 bg-gray-100 rounded-lg animate-pulse" />
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-500 border-b border-gray-100">
                    <th className="pb-2 text-left font-medium">Type</th>
                    <th className="pb-2 text-center font-medium">Count</th>
                    <th className="pb-2 text-right font-medium">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {[
                    ["Rent — SHORT",    rb.rent_short_count    ?? 0, rb.rent_short_amount    ?? 0, "text-amber-700"],
                    ["Rent — ADVANCE",  rb.rent_advance_count  ?? 0, rb.rent_advance_amount  ?? 0, "text-blue-700"],
                    ["Majlis — SHORT",  rb.majlis_short_count  ?? 0, rb.majlis_short_amount  ?? 0, "text-amber-700"],
                    ["Majlis — ADVANCE",rb.majlis_advance_count?? 0, rb.majlis_advance_amount?? 0, "text-blue-700"],
                  ].map(([label, count, amount, cls]) => (
                    <tr key={label}>
                      <td className="py-2.5 text-gray-700">{label}</td>
                      <td className="py-2.5 text-center text-gray-500">{count}</td>
                      <td className={cn("py-2.5 text-right font-medium", count > 0 ? cls : "text-gray-300")}>{PKR(amount)}</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t border-gray-200">
                    <td className="pt-2 font-semibold text-gray-700">Total Outstanding</td>
                    <td className="pt-2 text-center font-semibold text-gray-600">
                      {(rb.rent_short_count ?? 0) + (rb.majlis_short_count ?? 0)}
                    </td>
                    <td className="pt-2 text-right font-bold text-amber-700">{PKR(pos?.total_receivables ?? 0)}</td>
                  </tr>
                </tfoot>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* ── All-trusts side-by-side ────────────────────────────────────────── */}
      {allTrusts.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-3">All Trusts Overview</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {allTrusts.map(t => <TrustColumn key={t.trust_id} trust={t} />)}
          </div>
        </div>
      )}

      {/* ── Recent transactions ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
          <span className="text-xs text-gray-400 ml-1">(last 25)</span>
          <button
            onClick={load}
            className="ml-auto p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 transition-colors"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
        {error && (
          <div className="mx-6 mt-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">{error}</div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Ref No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Party</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Particulars</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Debit (In)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Credit (Out)</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 8 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : recentEntries.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <DollarSign className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No cash transactions yet</p>
                    <p className="text-xs mt-1">Post journal entries to CASH or BANK accounts to see them here.</p>
                  </td>
                </tr>
              ) : (
                recentEntries.map((e, idx) => (
                  <tr key={`${e.source}-${e.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(e.date)}</td>
                    <td className="px-4 py-3">
                      <span className={cn(
                        "px-1.5 py-0.5 rounded text-xs font-bold",
                        e.source === "CASH" ? "bg-emerald-100 text-emerald-700"
                          : e.source === "BOX" ? "bg-violet-100 text-violet-700"
                          : "bg-blue-100 text-blue-700"
                      )}>
                        {e.source}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-500">{e.receipt_no || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{e.party_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{e.particulars || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      {e.debit > 0
                        ? <span className="text-emerald-700 font-medium flex items-center justify-end gap-1"><TrendingUp className="w-3 h-3" />{PKR(e.debit)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.credit > 0
                        ? <span className="text-red-600 font-medium flex items-center justify-end gap-1"><TrendingDown className="w-3 h-3" />{PKR(e.credit)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {PKR(Math.abs(e.balance))}
                      <span className="text-xs font-normal text-gray-400 ml-1">{e.balance < 0 ? "CR" : "DR"}</span>
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
