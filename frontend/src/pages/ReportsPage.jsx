import { useState, useEffect, useCallback } from "react";
import { Download, FileText, Loader2 } from "lucide-react";
import { useTrust } from "../context/TrustContext";

const API = "http://localhost:8000";

const TABS = [
  { id: "tb", label: "Trial Balance" },
  { id: "is", label: "Income Statement" },
  { id: "bs", label: "Balance Sheet" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: 6 }, (_, i) => CURRENT_YEAR - i);

function fmt(n) {
  if (n == null) return "—";
  return n.toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

function SectionHeader({ label, cols }) {
  return (
    <tr className="bg-slate-700 text-white">
      <td colSpan={cols} className="px-4 py-2 text-sm font-semibold">{label}</td>
    </tr>
  );
}

function TotalRow({ label, value, cols, positive }) {
  const color = value >= 0 ? "text-emerald-400" : "text-red-400";
  return (
    <tr className="bg-slate-800 text-white font-semibold">
      <td colSpan={cols - 1} className="px-4 py-2 text-sm text-right">{label}</td>
      <td className={`px-4 py-2 text-sm text-right ${positive !== false ? color : ""}`}>
        {fmt(value)}
      </td>
    </tr>
  );
}

function typeColor(type) {
  const map = {
    ASSET: "bg-blue-100 text-blue-700",
    LIABILITY: "bg-red-100 text-red-700",
    EQUITY: "bg-purple-100 text-purple-700",
    CAPITAL: "bg-purple-100 text-purple-700",
    INCOME: "bg-emerald-100 text-emerald-700",
    EXPENSE: "bg-orange-100 text-orange-700",
  };
  return map[type] ?? "bg-gray-100 text-gray-700";
}

// ── Trial Balance ─────────────────────────────────────────────────────────────

function TrialBalanceTab({ trustId, year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!trustId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ trust_id: trustId });
      if (year !== "all") params.set("year", year);
      const res = await fetch(`/api/reports/trial-balance?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [trustId, year]);

  useEffect(() => { load(); }, [load]);

  function downloadCSV() {
    if (!data) return;
    const rows = [
      ["Code", "Name", "Type", "Debit", "Credit", "Balance"],
      ...data.accounts.map((r) => [r.code, r.name, r.type, r.debit, r.credit, r.balance]),
      ["", "", "TOTAL", data.total_debit, data.total_credit, ""],
    ];
    const csv = rows.map((r) => r.map((v) => `"${v}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `trial-balance-${year}.csv`;
    a.click();
  }

  if (loading) return <p className="text-center py-10 text-gray-500">Loading…</p>;
  if (!data) return null;

  return (
    <div>
      <div className="flex justify-end mb-3">
        <button
          onClick={downloadCSV}
          className="flex items-center gap-2 px-3 py-1.5 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700"
        >
          <Download className="w-4 h-4" /> Download CSV
        </button>
      </div>
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Account Name</th>
              <th className="px-4 py-3 text-left">Type</th>
              <th className="px-4 py-3 text-right">Debit (PKR)</th>
              <th className="px-4 py-3 text-right">Credit (PKR)</th>
              <th className="px-4 py-3 text-right">Balance</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((row, i) => (
              <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.name}</td>
                <td className="px-4 py-2">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${typeColor(row.type)}`}>
                    {row.type}
                  </span>
                </td>
                <td className="px-4 py-2 text-right text-gray-700">{fmt(row.debit)}</td>
                <td className="px-4 py-2 text-right text-gray-700">{fmt(row.credit)}</td>
                <td className={`px-4 py-2 text-right font-medium ${row.balance >= 0 ? "text-gray-800" : "text-red-600"}`}>
                  {fmt(row.balance)}
                </td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="bg-slate-800 text-white font-semibold">
              <td colSpan={3} className="px-4 py-3 text-right text-sm">TOTALS</td>
              <td className="px-4 py-3 text-right text-sm">{fmt(data.total_debit)}</td>
              <td className="px-4 py-3 text-right text-sm">{fmt(data.total_credit)}</td>
              <td className="px-4 py-3" />
            </tr>
          </tfoot>
        </table>
      </div>
      <p className="text-xs text-gray-400 mt-2">{data.accounts.length} accounts</p>
    </div>
  );
}

// ── Income Statement ──────────────────────────────────────────────────────────

function IncomeStatementTab({ trustId, year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!trustId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ trust_id: trustId });
      if (year !== "all") params.set("year", year);
      const res = await fetch(`/api/reports/income-statement?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [trustId, year]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-center py-10 text-gray-500">Loading…</p>;
  if (!data) return null;

  const surplus = data.net_surplus;

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-slate-800 text-white">
            <th className="px-4 py-3 text-left">Code</th>
            <th className="px-4 py-3 text-left">Account Name</th>
            <th className="px-4 py-3 text-right">Amount (PKR)</th>
          </tr>
        </thead>
        <tbody>
          <SectionHeader label="INCOME" cols={3} />
          {data.income.map((row, i) => (
            <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
              <td className="px-4 py-2 text-gray-800">{row.name}</td>
              <td className="px-4 py-2 text-right text-emerald-700 font-medium">{fmt(row.amount)}</td>
            </tr>
          ))}
          <TotalRow label="Total Income" value={data.total_income} cols={3} />

          <tr><td colSpan={3} className="h-2" /></tr>

          <SectionHeader label="EXPENSES" cols={3} />
          {data.expenses.map((row, i) => (
            <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
              <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
              <td className="px-4 py-2 text-gray-800">{row.name}</td>
              <td className="px-4 py-2 text-right text-orange-700 font-medium">{fmt(row.amount)}</td>
            </tr>
          ))}
          <TotalRow label="Total Expenses" value={data.total_expense} cols={3} positive={false} />

          <tr><td colSpan={3} className="h-2" /></tr>

          <tr className={`font-bold text-base ${surplus >= 0 ? "bg-emerald-700" : "bg-red-700"} text-white`}>
            <td colSpan={2} className="px-4 py-3 text-right">
              {surplus >= 0 ? "NET SURPLUS" : "NET DEFICIT"}
            </td>
            <td className="px-4 py-3 text-right">{fmt(Math.abs(surplus))}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ── Balance Sheet ─────────────────────────────────────────────────────────────

function BalanceSheetTab({ trustId, year }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    if (!trustId) return;
    setLoading(true);
    try {
      const params = new URLSearchParams({ trust_id: trustId });
      if (year !== "all") params.set("year", year);
      const res = await fetch(`/api/reports/balance-sheet?${params}`);
      setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [trustId, year]);

  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-center py-10 text-gray-500">Loading…</p>;
  if (!data) return null;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      {/* Assets side */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Account</th>
              <th className="px-4 py-3 text-right">PKR</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="ASSETS" cols={3} />
            {data.assets.map((row, i) => (
              <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.name}</td>
                <td className="px-4 py-2 text-right text-blue-700 font-medium">{fmt(row.amount)}</td>
              </tr>
            ))}
            <TotalRow label="Total Assets" value={data.total_assets} cols={3} />
          </tbody>
        </table>
      </div>

      {/* Liabilities + Equity side */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-slate-800 text-white">
              <th className="px-4 py-3 text-left">Code</th>
              <th className="px-4 py-3 text-left">Account</th>
              <th className="px-4 py-3 text-right">PKR</th>
            </tr>
          </thead>
          <tbody>
            <SectionHeader label="LIABILITIES" cols={3} />
            {data.liabilities.map((row, i) => (
              <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.name}</td>
                <td className="px-4 py-2 text-right text-red-700 font-medium">{fmt(row.amount)}</td>
              </tr>
            ))}
            <TotalRow label="Total Liabilities" value={data.total_liab} cols={3} positive={false} />

            <tr><td colSpan={3} className="h-2" /></tr>

            <SectionHeader label="EQUITY / FUND" cols={3} />
            {data.equity.map((row, i) => (
              <tr key={row.code} className={i % 2 === 0 ? "bg-white" : "bg-slate-50"}>
                <td className="px-4 py-2 font-mono text-xs text-gray-600">{row.code}</td>
                <td className="px-4 py-2 text-gray-800">{row.name}</td>
                <td className="px-4 py-2 text-right text-purple-700 font-medium">{fmt(row.amount)}</td>
              </tr>
            ))}
            <tr className={data.net_profit >= 0 ? "bg-white" : "bg-red-50"}>
              <td className="px-4 py-2 font-mono text-xs text-gray-400">—</td>
              <td className="px-4 py-2 text-gray-600 italic">Net Profit / (Loss)</td>
              <td className={`px-4 py-2 text-right font-medium ${data.net_profit >= 0 ? "text-emerald-700" : "text-red-700"}`}>
                {fmt(data.net_profit)}
              </td>
            </tr>
            <TotalRow label="Total Liab. & Equity" value={data.total_liab_equity} cols={3} />
          </tbody>
        </table>
      </div>

      {/* Balance check */}
      {Math.abs(data.total_assets - data.total_liab_equity) > 1 && (
        <div className="lg:col-span-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Balance sheet difference: <strong>{fmt(Math.abs(data.total_assets - data.total_liab_equity))} PKR</strong> — may indicate unbalanced entries or missing accounts.
        </div>
      )}
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const REPORT_TYPE_MAP = { tb: "trial-balance", is: "income-statement", bs: "balance-sheet" };

export default function ReportsPage() {
  const { selectedTrust } = useTrust();
  const [activeTab, setActiveTab] = useState("tb");
  const [year, setYear] = useState(String(CURRENT_YEAR));
  const [pdfLoading, setPdfLoading] = useState(false);

  const trustId = selectedTrust?.id;

  async function exportPdf() {
    if (!trustId) return;
    setPdfLoading(true);
    try {
      const body = {
        trust_id: trustId,
        report_type: REPORT_TYPE_MAP[activeTab] || activeTab,
        year: year === "all" ? null : parseInt(year),
      };
      const res = await fetch(`${API}/api/reports/pdf`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("Export failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 30000);
    } catch (e) {
      alert(e.message);
    } finally {
      setPdfLoading(false);
    }
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Financial Reports</h2>
          <p className="text-sm text-gray-500 mt-0.5">
            {selectedTrust?.name ?? "—"} · {year === "all" ? "All Periods" : `FY ${year}`}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* PDF export */}
          <button
            onClick={exportPdf}
            disabled={pdfLoading || !trustId}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
          >
            {pdfLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
            Export PDF
          </button>

          {/* Year filter */}
          <select
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            <option value="all">All Periods</option>
            {YEARS.map((y) => (
              <option key={y} value={String(y)}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-1">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-5 py-2.5 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Content */}
      {!trustId ? (
        <p className="text-center py-10 text-gray-400">Select a trust to view reports.</p>
      ) : activeTab === "tb" ? (
        <TrialBalancePage trustId={trustId} year={year} />
      ) : activeTab === "is" ? (
        <IncomeStatementTab trustId={trustId} year={year} />
      ) : (
        <BalanceSheetTab trustId={trustId} year={year} />
      )}
    </div>
  );
}

function TrialBalancePage({ trustId, year }) {
  return <TrialBalanceTab trustId={trustId} year={year} />;
}
