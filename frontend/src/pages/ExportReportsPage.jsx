import { useState } from "react";
import { useTrust } from "../context/TrustContext";
import { Download, FileSpreadsheet, BarChart2, BookOpen, Scale, TableProperties } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";
const THIS_YEAR = new Date().getFullYear();

const SHEET_PREVIEWS = [
  { icon: BarChart2, label: "Trial Balance",    desc: "All accounts with total debits, credits and closing balance." },
  { icon: BookOpen,  label: "General Ledger",   desc: "Every transaction grouped by account with running balance." },
  { icon: BarChart2, label: "Income Statement", desc: "Income vs Expenses — net profit or loss for the period." },
  { icon: Scale,     label: "Balance Sheet",    desc: "Assets = Liabilities + Equity snapshot at period end." },
];

async function triggerDownload(url, fallbackName) {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail ?? "Export failed");
  }
  const blob = await res.blob();
  const blobUrl = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  const cd = res.headers.get("Content-Disposition") ?? "";
  const match = cd.match(/filename="([^"]+)"/);
  a.download = match ? match[1] : fallbackName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(blobUrl);
}

export default function ExportReportsPage() {
  const { selectedTrust, trusts, setSelectedTrust } = useTrust();
  const [dateFrom, setDateFrom] = useState(`${THIS_YEAR - 1}-07-01`);
  const [dateTo,   setDateTo]   = useState(`${THIS_YEAR}-06-30`);
  const [ledgerYear, setLedgerYear] = useState(String(THIS_YEAR));
  const [fullYear,   setFullYear]   = useState(String(THIS_YEAR));

  const [dlReports, setDlReports] = useState(false);
  const [dlLedger,  setDlLedger]  = useState(false);
  const [dlFull,    setDlFull]    = useState(null);   // null | "full" | "ledger" | "tb"
  const [error, setError] = useState(null);

  const presets = [
    { label: `FY ${THIS_YEAR - 1}–${THIS_YEAR}`,     from: `${THIS_YEAR - 1}-07-01`, to: `${THIS_YEAR}-06-30` },
    { label: `FY ${THIS_YEAR - 2}–${THIS_YEAR - 1}`, from: `${THIS_YEAR - 2}-07-01`, to: `${THIS_YEAR - 1}-06-30` },
    { label: "This year",                             from: `${THIS_YEAR}-01-01`,     to: `${THIS_YEAR}-12-31` },
    { label: "All time",                              from: "2000-01-01",             to: `${THIS_YEAR}-12-31` },
  ];

  async function handleReports() {
    if (!selectedTrust) return;
    setDlReports(true);
    setError(null);
    try {
      const params = new URLSearchParams({ trust_id: selectedTrust.id, date_from: dateFrom, date_to: dateTo });
      await triggerDownload(`${API}/api/export/reports?${params}`, `${selectedTrust.code}_reports.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDlReports(false);
    }
  }

  async function handleLedger() {
    if (!selectedTrust) return;
    setDlLedger(true);
    setError(null);
    try {
      const params = new URLSearchParams({ trust_id: selectedTrust.id });
      if (ledgerYear) params.set("year", ledgerYear);
      await triggerDownload(`${API}/api/export/ledger?${params}`, `${selectedTrust.code}_ledger.xlsx`);
    } catch (err) {
      setError(err.message);
    } finally {
      setDlLedger(false);
    }
  }

  async function handleFull(mode) {
    if (!selectedTrust || dlFull) return;
    setDlFull(mode);
    setError(null);
    try {
      const params = new URLSearchParams({ trust_id: selectedTrust.id, mode });
      if (fullYear) params.set("year", fullYear);
      await triggerDownload(
        `${API}/api/export/full?${params}`,
        `${selectedTrust.code}-${fullYear || "all"}${mode !== "full" ? `-${mode}` : ""}.xlsx`
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setDlFull(null);
    }
  }

  const yearOptions = [];
  for (let y = THIS_YEAR; y >= THIS_YEAR - 10; y--) yearOptions.push(y);

  return (
    <div className="space-y-6">

      {/* ── Export 1: Summary Reports ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">Summary Reports</h2>
        <p className="text-xs text-gray-400 mb-4">Trial Balance, General Ledger view, Income Statement, Balance Sheet — one file.</p>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 mb-4">
          {presets.map((p) => (
            <button
              key={p.label}
              onClick={() => { setDateFrom(p.from); setDateTo(p.to); }}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors",
                dateFrom === p.from && dateTo === p.to
                  ? "bg-emerald-600 text-white border-emerald-600"
                  : "border-gray-300 text-gray-600 hover:border-emerald-400 hover:text-emerald-600"
              )}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">From</label>
            <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">To</label>
            <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-5">
          {SHEET_PREVIEWS.map(({ icon: Icon, label, desc }) => (
            <div key={label} className="bg-gray-50 rounded-lg border border-gray-100 p-3">
              <Icon className="w-5 h-5 text-emerald-600 mb-1.5" />
              <p className="text-xs font-semibold text-gray-900 mb-0.5">{label}</p>
              <p className="text-xs text-gray-400">{desc}</p>
            </div>
          ))}
        </div>

        <div className="flex justify-end">
          <button onClick={handleReports} disabled={dlReports || !selectedTrust}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 text-white text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 transition-colors shadow-sm">
            {dlReports
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
              : <><Download className="w-4 h-4" /> Download Reports</>}
          </button>
        </div>
      </div>

      {/* ── Export 2: WPF Ledger format ───────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-sm font-semibold text-gray-900 mb-1">WPF-Format Ledger Export</h2>
        <p className="text-xs text-gray-400 mb-4">
          One sheet per account — same structure as the original WPF Excel file. Use this to re-import or archive data.
        </p>

        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fiscal Year ending June</label>
            <select value={ledgerYear} onChange={(e) => setLedgerYear(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
              <option value="">All time</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>FY {y - 1}–{y}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-400">
            Each account gets its own sheet named by account code.<br />
            TB, IS, BS summary sheets are appended at the end.
          </div>
        </div>

        <div className="flex justify-end">
          <button onClick={handleLedger} disabled={dlLedger || !selectedTrust}
            className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-slate-700 text-white text-sm font-semibold hover:bg-slate-800 disabled:opacity-50 transition-colors shadow-sm">
            {dlLedger
              ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
              : <><FileSpreadsheet className="w-4 h-4" /> Download Ledger</>}
          </button>
        </div>
      </div>

      {/* ── Export 3: WPF Full Workbook (exact round-trip format) ────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-1">
          <TableProperties className="w-4 h-4 text-emerald-600" />
          <h2 className="text-sm font-semibold text-gray-900">WPF Full Workbook Export</h2>
        </div>
        <p className="text-xs text-gray-400 mb-4">
          Exact replica of the imported WPF file — one sheet per account, same row layout and column structure.
          Re-importable with zero changes.
        </p>

        <div className="flex flex-wrap items-end gap-4 mb-5">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Trust</label>
            <select
              value={selectedTrust?.id ?? ""}
              onChange={(e) => {
                const t = trusts.find((t) => t.id === Number(e.target.value));
                if (t) setSelectedTrust(t);
              }}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              {trusts.map((t) => (
                <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Fiscal Year ending June</label>
            <select
              value={fullYear}
              onChange={(e) => setFullYear(e.target.value)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="">All time</option>
              {yearOptions.map((y) => (
                <option key={y} value={y}>FY {y - 1}–{y}</option>
              ))}
            </select>
          </div>
          <div className="text-xs text-gray-400 leading-relaxed">
            Dark-green headers · Light-green alternating rows<br />
            Sheets: one per account + TB + IS + BS
          </div>
        </div>

        <div className="flex flex-wrap justify-end gap-2">
          {[
            { mode: "full",   label: "Full Workbook",    icon: FileSpreadsheet, cls: "bg-emerald-600 hover:bg-emerald-700" },
            { mode: "ledger", label: "Ledger Only",      icon: BookOpen,        cls: "bg-slate-700 hover:bg-slate-800" },
            { mode: "tb",     label: "Trial Balance",    icon: BarChart2,       cls: "bg-slate-600 hover:bg-slate-700" },
          ].map(({ mode, label, icon: Icon, cls }) => (
            <button
              key={mode}
              onClick={() => handleFull(mode)}
              disabled={!selectedTrust || dlFull !== null}
              className={cn(
                "flex items-center gap-2 px-5 py-2.5 rounded-lg text-white text-sm font-semibold transition-colors shadow-sm disabled:opacity-50",
                cls
              )}
            >
              {dlFull === mode
                ? <><div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" /> Generating…</>
                : <><Icon className="w-4 h-4" /> {label}</>}
            </button>
          ))}
        </div>
      </div>

      {/* ── Formatting note ───────────────────────────────────────────────── */}
      <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 text-xs text-slate-600">
        <p className="font-medium text-slate-800 mb-1.5">Excel formatting included in both exports</p>
        <ul className="list-disc ml-4 space-y-0.5">
          <li>Bold headers with dark background and white text</li>
          <li>Alternating row colors for readability</li>
          <li>Borders on all cells, fixed column widths</li>
          <li>Currency formatting (PKR) for all amount columns</li>
          <li>Frozen top rows for easy scrolling</li>
        </ul>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
          {error}
        </div>
      )}

      {selectedTrust && (
        <p className="text-xs text-center text-gray-400">
          Exports will be generated for <strong>{selectedTrust.name}</strong>
        </p>
      )}
    </div>
  );
}
