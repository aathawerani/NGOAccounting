import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import {
  Banknote, Inbox, TrendingUp, ArrowRight, Wallet, AlertTriangle,
  HardDrive, CheckCircle, Loader2, Bell, RotateCcw,
} from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function SummaryCard({ icon: Icon, label, value, sub, color, onClick }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "bg-white rounded-xl border shadow-sm p-5 text-left w-full group transition-all hover:shadow-md hover:-translate-y-0.5",
        color === "emerald" ? "border-emerald-200 hover:border-emerald-300"
          : color === "amber" ? "border-amber-200 hover:border-amber-300"
          : color === "blue" ? "border-blue-200 hover:border-blue-300"
          : color === "violet" ? "border-violet-200 hover:border-violet-300"
          : "border-gray-200 hover:border-gray-300"
      )}
    >
      <div className="flex items-start justify-between mb-3">
        <div className={cn(
          "w-10 h-10 rounded-lg flex items-center justify-center",
          color === "emerald" ? "bg-emerald-100"
            : color === "amber" ? "bg-amber-100"
            : color === "blue" ? "bg-blue-100"
            : color === "violet" ? "bg-violet-100"
            : "bg-gray-100"
        )}>
          <Icon className={cn(
            "w-5 h-5",
            color === "emerald" ? "text-emerald-600"
              : color === "amber" ? "text-amber-600"
              : color === "blue" ? "text-blue-600"
              : color === "violet" ? "text-violet-600"
              : "text-gray-600"
          )} />
        </div>
        <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-gray-500 transition-colors mt-1" />
      </div>
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-2xl font-bold text-gray-900 leading-tight">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </button>
  );
}

export default function DashboardPage({ onNavigate }) {
  const { selectedTrust } = useTrust();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [backing, setBacking] = useState(false);
  const [backupMsg, setBackupMsg] = useState(null);
  const [maturing, setMaturing] = useState([]);

  const fetchSummary = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/dashboard/summary?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setData(await res.json());
    } catch {
      // silently fail — page still renders
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  const fetchMaturing = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/investments/maturing?trust_id=${selectedTrust.id}&days=60`);
      if (!res.ok) return;
      setMaturing(await res.json());
    } catch { /* ignore */ }
  }, [selectedTrust]);

  useEffect(() => { fetchSummary(); fetchMaturing(); }, [fetchSummary, fetchMaturing]);

  const runBackup = useCallback(async () => {
    setBacking(true);
    setBackupMsg(null);
    try {
      const res = await fetch(`${API}/api/backup/create`, { method: "POST" });
      const json = await res.json();
      if (json.ok) {
        setBackupMsg({ ok: true, text: `Backup saved — ${json.excel_files.length} Excel file(s) + DB snapshot` });
        fetchSummary(); // refresh last_backup timestamp
      } else {
        setBackupMsg({ ok: false, text: "Backup failed" });
      }
    } catch {
      setBackupMsg({ ok: false, text: "Could not reach server" });
    } finally {
      setBacking(false);
    }
  }, [fetchSummary]);

  const trustColor = selectedTrust?.code === "HVHT" ? "emerald"
    : selectedTrust?.code === "BIB" ? "blue"
    : "violet";

  return (
    <div className="space-y-6">
      {/* ── Trust Header ─────────────────────────────────────────────────── */}
      <div className={cn(
        "rounded-xl p-5 text-white",
        trustColor === "emerald" ? "bg-emerald-600"
          : trustColor === "blue" ? "bg-blue-600"
          : "bg-violet-600"
      )}>
        <p className="text-sm font-medium opacity-80 mb-1">Active Trust</p>
        <h1 className="text-xl font-bold">{selectedTrust?.name ?? "—"}</h1>
        <p className="text-sm opacity-70 mt-0.5">{selectedTrust?.code}</p>
      </div>

      {/* ── Summary Cards ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 animate-pulse">
              <div className="w-10 h-10 bg-gray-200 rounded-lg mb-3" />
              <div className="h-3 bg-gray-200 rounded w-20 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-28" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard
            icon={Banknote}
            label="Total Cash & Bank"
            value={PKR(data?.cash_total ?? 0)}
            sub={data?.cash_accounts?.length ? `${data.cash_accounts.length} account(s)` : undefined}
            color="emerald"
            onClick={() => onNavigate("cash-position")}
          />
          <SummaryCard
            icon={Wallet}
            label="Active Investments"
            value={PKR(data?.investment_total ?? 0)}
            sub="Certificates at face value"
            color="blue"
            onClick={() => onNavigate("investments")}
          />
          <SummaryCard
            icon={Inbox}
            label="Pending Receivables"
            value={data?.pending_receivables_count ?? 0}
            sub={data?.pending_receivables_amount ? PKR(data.pending_receivables_amount) : "None outstanding"}
            color={data?.pending_receivables_count > 0 ? "amber" : undefined}
            onClick={() => onNavigate("receivables")}
          />
          <SummaryCard
            icon={TrendingUp}
            label="Journal Entries"
            value="View Ledger"
            sub="Accounts & transactions"
            color="violet"
            onClick={() => onNavigate("journal-entries")}
          />
        </div>
      )}

      {/* ── Investment Maturity Alerts ───────────────────────────────────── */}
      {maturing.length > 0 && (
        <div className="bg-white rounded-xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-amber-100 bg-amber-50/60">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-amber-600" />
              <h2 className="text-sm font-semibold text-amber-800">
                Maturing Soon — {maturing.length} certificate{maturing.length !== 1 ? "s" : ""}
              </h2>
            </div>
            <button onClick={() => onNavigate("investments")}
              className="text-xs font-medium text-amber-700 hover:underline">
              Manage Investments →
            </button>
          </div>
          <div className="divide-y divide-gray-50">
            {maturing.map(inv => {
              const urgencyClasses = inv.urgency === "red"
                ? { badge: "bg-red-100 text-red-700", days: "text-red-600" }
                : inv.urgency === "orange"
                  ? { badge: "bg-orange-100 text-orange-700", days: "text-orange-600" }
                  : { badge: "bg-amber-100 text-amber-700", days: "text-amber-600" };
              return (
                <div key={inv.id} className="flex items-center gap-4 px-5 py-3">
                  <div className={cn("flex-shrink-0 px-2 py-0.5 rounded-full text-xs font-semibold", urgencyClasses.badge)}>
                    {inv.certificate_type}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-800 truncate">
                      {inv.certificate_number}
                      {inv.folio_number && <span className="text-gray-400 font-normal ml-1">({inv.folio_number})</span>}
                    </p>
                    <p className="text-xs text-gray-400">Matures {inv.maturity_date} · {PKR(inv.amount)}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className={cn("text-sm font-bold", urgencyClasses.days)}>
                      {inv.days_remaining}d
                    </p>
                    <p className="text-xs text-gray-400">remaining</p>
                  </div>
                  <button onClick={() => onNavigate("investments")} title="Renew"
                    className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <RotateCcw className="w-3.5 h-3.5" />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Cash Account Breakdown ────────────────────────────────────────── */}
      {data?.cash_accounts?.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-3">Cash & Bank Balances</h2>
          <div className="space-y-2">
            {data.cash_accounts.map((a) => (
              <div key={a.code} className="flex items-center justify-between py-1.5 border-b border-gray-50 last:border-0">
                <div>
                  <span className="font-mono text-xs text-gray-400 mr-2">{a.code}</span>
                  <span className="text-sm text-gray-700">{a.name}</span>
                </div>
                <span className={cn(
                  "text-sm font-semibold",
                  a.balance < 0 ? "text-red-600" : "text-gray-900"
                )}>
                  {PKR(a.balance)}
                </span>
              </div>
            ))}
            <div className="flex items-center justify-between pt-2">
              <span className="text-sm font-semibold text-gray-700">Total</span>
              <span className="text-base font-bold text-emerald-700">{PKR(data.cash_total)}</span>
            </div>
          </div>
        </div>
      )}

      {/* ── Recent Transactions ───────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">Recent Transactions</h2>
          <button
            onClick={() => onNavigate("journal-entries")}
            className="text-xs text-emerald-600 hover:underline font-medium"
          >
            View all
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Contra</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Particulars</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : !data?.recent_transactions?.length ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-gray-400">
                    <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">No transactions yet for this trust</p>
                  </td>
                </tr>
              ) : (
                data.recent_transactions.map((t, i) => (
                  <tr key={i} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-700 whitespace-nowrap">{t.account_code}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-400 whitespace-nowrap">{t.contra_account_code || "—"}</td>
                    <td className="px-4 py-3 text-gray-600 truncate max-w-xs">{t.particulars || "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">{PKR(t.amount)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Quick Actions ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { label: "New Rent Receipt", page: "rent-entry" },
          { label: "New Journal Entry", page: "journal-entries" },
          { label: "Import Excel", page: "import-excel" },
          { label: "Export Reports", page: "export-reports" },
        ].map(({ label, page }) => (
          <button
            key={page}
            onClick={() => onNavigate(page)}
            className="bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 hover:border-gray-300 transition-all text-left"
          >
            {label}
            <ArrowRight className="inline w-3.5 h-3.5 ml-1 text-gray-400" />
          </button>
        ))}
      </div>

      {/* ── Backup ───────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4 flex flex-col sm:flex-row items-start sm:items-center gap-3">
        <HardDrive className="w-5 h-5 text-gray-400 shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-700">Data Backup</p>
          <p className="text-xs text-gray-400">
            {data?.last_backup
              ? <>Last backup: <span className="font-medium text-gray-600">{fmtDate(data.last_backup)}</span></>
              : "No backup yet — click to create one"}
          </p>
        </div>
        {backupMsg && (
          <div className={cn(
            "flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-lg",
            backupMsg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
          )}>
            {backupMsg.ok && <CheckCircle className="w-3.5 h-3.5" />}
            {backupMsg.text}
          </div>
        )}
        <button
          onClick={runBackup}
          disabled={backing}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-900 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50 shrink-0"
        >
          {backing ? <Loader2 className="w-4 h-4 animate-spin" /> : <HardDrive className="w-4 h-4" />}
          {backing ? "Backing up…" : "Backup Now"}
        </button>
      </div>
    </div>
  );
}
