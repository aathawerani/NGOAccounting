import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { DollarSign, TrendingUp, TrendingDown } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function StatCard({ label, value, sub, color }) {
  return (
    <div className={cn("rounded-xl border p-5", color)}>
      <p className="text-xs font-medium opacity-70 mb-1">{label}</p>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

export default function CashPositionPage() {
  const { selectedTrust } = useTrust();
  const [cashLedger, setCashLedger] = useState(null);
  const [bankLedger, setBankLedger] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const fetchLedger = useCallback(async (code) => {
    if (!selectedTrust) return null;
    try {
      const res = await fetch(
        `${API}/api/accounts/ledger?trust_id=${selectedTrust.id}&account_code=${encodeURIComponent(code)}`
      );
      if (res.status === 404) return null;
      if (!res.ok) throw new Error();
      return await res.json();
    } catch {
      return null;
    }
  }, [selectedTrust]);

  const load = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    setError(null);
    try {
      const [cash, bank] = await Promise.all([
        fetchLedger("CASH"),
        fetchLedger("BANK"),
      ]);
      setCashLedger(cash);
      setBankLedger(bank);
    } catch {
      setError("Failed to load cash position");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust, fetchLedger]);

  useEffect(() => { load(); }, [load]);

  const cashBalance = cashLedger?.balance ?? 0;
  const bankBalance = bankLedger?.balance ?? 0;
  const totalLiquid = cashBalance + bankBalance;

  const recentEntries = [
    ...(cashLedger?.entries ?? []).map((e) => ({ ...e, source: "CASH" })),
    ...(bankLedger?.entries ?? []).map((e) => ({ ...e, source: "BANK" })),
  ]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 20);

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
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard
          label="Cash in Hand"
          value={PKR(cashBalance)}
          sub={cashLedger ? `${cashLedger.entries.length} transactions` : "No account"}
          color="bg-emerald-50 border-emerald-200 text-emerald-900"
        />
        <StatCard
          label="Bank Balance"
          value={PKR(bankBalance)}
          sub={bankLedger ? `${bankLedger.entries.length} transactions` : "No bank account"}
          color="bg-blue-50 border-blue-200 text-blue-900"
        />
        <StatCard
          label="Total Liquid Assets"
          value={PKR(totalLiquid)}
          sub="Cash + Bank"
          color="bg-slate-800 border-slate-700 text-white"
        />
      </div>

      {/* ── Recent transactions ────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <DollarSign className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
          <span className="text-xs text-gray-400 ml-1">(last 20)</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Ref No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Party</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Particulars</th>
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
                      <span className={cn("px-1.5 py-0.5 rounded text-xs font-bold",
                        e.source === "CASH" ? "bg-emerald-100 text-emerald-700" : "bg-blue-100 text-blue-700")}>
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
