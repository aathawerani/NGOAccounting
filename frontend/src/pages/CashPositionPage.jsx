import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { DollarSign, TrendingUp, TrendingDown, RefreshCw } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const CASH_CODES = new Set(["CASH", "BANK", "BOX"]);
const isCashAccount = (code) =>
  CASH_CODES.has(code) || code.startsWith("BANK");

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

const ACCOUNT_COLORS = [
  "bg-emerald-50 border-emerald-200 text-emerald-900",
  "bg-blue-50 border-blue-200 text-blue-900",
  "bg-violet-50 border-violet-200 text-violet-900",
  "bg-amber-50 border-amber-200 text-amber-900",
];

function StatCard({ label, value, sub, color, idx }) {
  const c = color ?? ACCOUNT_COLORS[idx % ACCOUNT_COLORS.length];
  return (
    <div className={cn("rounded-xl border p-5", c)}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

export default function CashPositionPage() {
  const { selectedTrust } = useTrust();
  const [cashAccounts, setCashAccounts] = useState([]); // [{ code, name, ledger }]
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    setError(null);
    try {
      // 1. Fetch all account types for this trust
      const typesRes = await fetch(`${API}/api/accounts/types?trust_id=${selectedTrust.id}`);
      if (!typesRes.ok) throw new Error("Failed to load account types");
      const types = await typesRes.json();

      // 2. Filter to cash/bank-like ASSET accounts
      const liquid = types.filter(
        (a) => a.account_type === "ASSET" && isCashAccount(a.account_code)
      );

      // 3. Fetch ledger for each in parallel
      const ledgers = await Promise.all(
        liquid.map(async (a) => {
          try {
            const res = await fetch(
              `${API}/api/accounts/ledger?trust_id=${selectedTrust.id}&account_code=${encodeURIComponent(a.account_code)}`
            );
            if (!res.ok) return { ...a, ledger: null };
            return { ...a, ledger: await res.json() };
          } catch {
            return { ...a, ledger: null };
          }
        })
      );

      setCashAccounts(ledgers);
    } catch (err) {
      setError(err.message ?? "Failed to load cash position");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  useEffect(() => { load(); }, [load]);

  const totalLiquid = cashAccounts.reduce(
    (s, a) => s + (a.ledger?.balance ?? 0), 0
  );

  const recentEntries = cashAccounts
    .flatMap((a) => (a.ledger?.entries ?? []).map((e) => ({ ...e, source: a.account_code })))
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 25);

  if (loading) {
    return (
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="h-24 bg-gray-200 rounded-xl animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-red-700 text-sm">{error}</div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Summary cards ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {cashAccounts.map((a, idx) => (
          <StatCard
            key={a.account_code}
            label={a.account_name}
            value={PKR(a.ledger?.balance ?? 0)}
            sub={a.ledger ? `${a.ledger.entries.length} transactions` : "No entries yet"}
            idx={idx}
          />
        ))}
        <StatCard
          label="Total Liquid Assets"
          value={PKR(totalLiquid)}
          sub={`${cashAccounts.length} account${cashAccounts.length !== 1 ? "s" : ""}`}
          color="bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {cashAccounts.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-6 text-amber-800 text-sm text-center">
          No cash or bank accounts found for this trust.
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
              {recentEntries.length === 0 ? (
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
                        ? <span className="text-emerald-700 font-medium flex items-center justify-end gap-1">
                            <TrendingUp className="w-3 h-3" />{PKR(e.debit)}
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {e.credit > 0
                        ? <span className="text-red-600 font-medium flex items-center justify-end gap-1">
                            <TrendingDown className="w-3 h-3" />{PKR(e.credit)}
                          </span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                      {PKR(Math.abs(e.balance))}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        {e.balance < 0 ? "CR" : "DR"}
                      </span>
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
