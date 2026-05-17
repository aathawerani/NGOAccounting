import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import {
  Lock, CheckCircle, AlertTriangle, Loader2, ChevronRight, Archive,
} from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", {
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  });

const CURRENT_YEAR = new Date().getFullYear();
const FY_OPTIONS = Array.from({ length: 8 }, (_, i) => CURRENT_YEAR - i);

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", {
    day: "numeric", month: "short", year: "numeric",
  });
}

export default function FiscalYearClosePage() {
  const { selectedTrust } = useTrust();
  const [selectedYear, setSelectedYear] = useState(CURRENT_YEAR);
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [closedYears, setClosedYears] = useState([]);
  const [closing, setClosing] = useState(false);
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState(null);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const fetchClosed = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(
        `${API}/api/fiscal-year/closed-years?trust_id=${selectedTrust.id}`
      );
      setClosedYears(await res.json());
    } catch { /* ignore */ }
  }, [selectedTrust]);

  const fetchPreview = useCallback(async () => {
    if (!selectedTrust || !selectedYear) return;
    setLoadingPreview(true);
    setPreview(null);
    setMsg(null);
    try {
      const res = await fetch(
        `${API}/api/fiscal-year/preview?trust_id=${selectedTrust.id}&year=${selectedYear}`
      );
      const json = await res.json();
      if (!res.ok) {
        setMsg({ ok: false, text: json.detail ?? "Error loading preview" });
      } else {
        setPreview(json);
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach server" });
    } finally {
      setLoadingPreview(false);
    }
  }, [selectedTrust, selectedYear]);

  useEffect(() => { fetchClosed(); }, [fetchClosed]);
  useEffect(() => { fetchPreview(); }, [fetchPreview]);

  const isAlreadyClosed = closedYears.some((c) => c.fiscal_year === selectedYear);

  const handleClose = async () => {
    setConfirmOpen(false);
    setClosing(true);
    setMsg(null);
    try {
      const res = await fetch(`${API}/api/fiscal-year/close`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_id: selectedTrust.id,
          fiscal_year: selectedYear,
          note: note || null,
        }),
      });
      const json = await res.json();
      if (json.ok) {
        setMsg({
          ok: true,
          text: `FY${selectedYear} closed. ${json.opening_entries_created} opening entries created for FY${selectedYear + 1}.`,
        });
        fetchClosed();
        fetchPreview();
      } else {
        setMsg({ ok: false, text: json.detail ?? "Close failed" });
      }
    } catch {
      setMsg({ ok: false, text: "Could not reach server" });
    } finally {
      setClosing(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Fiscal Year Closing</h1>
        <p className="text-sm text-gray-500 mt-1">
          Close a fiscal year to lock entries and carry forward balances.
          Pakistani FY runs 1 Jul – 30 Jun.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── Left: Year selector + preview ───────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Fiscal Year to Close
            </label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {FY_OPTIONS.map((y) => (
                <option key={y} value={y}>
                  FY {y} (1 Jul {y - 1} – 30 Jun {y})
                </option>
              ))}
            </select>

            {isAlreadyClosed && (
              <div className="mt-3 flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                <Lock className="w-4 h-4 shrink-0" />
                FY{selectedYear} is already closed for this trust.
              </div>
            )}
          </div>

          {/* Preview panel */}
          {loadingPreview ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex items-center justify-center gap-2 text-gray-400">
              <Loader2 className="w-5 h-5 animate-spin" />
              Loading preview…
            </div>
          ) : preview && !isAlreadyClosed ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
              <h2 className="text-sm font-semibold text-gray-700">
                Preview — FY{preview.fiscal_year}
                <span className="text-xs font-normal text-gray-400 ml-2">
                  {preview.period.from} → {preview.period.to}
                </span>
              </h2>

              {/* Surplus / Deficit */}
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-3 text-center">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Total Income</p>
                  <p className="text-base font-bold text-emerald-800">{PKR(preview.income_total)}</p>
                </div>
                <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-3 text-center">
                  <p className="text-xs text-red-600 font-medium mb-1">Total Expenses</p>
                  <p className="text-base font-bold text-red-800">{PKR(preview.expense_total)}</p>
                </div>
                <div className={cn(
                  "border rounded-lg px-3 py-3 text-center",
                  preview.net_surplus >= 0
                    ? "bg-blue-50 border-blue-200"
                    : "bg-orange-50 border-orange-200"
                )}>
                  <p className={cn(
                    "text-xs font-medium mb-1",
                    preview.net_surplus >= 0 ? "text-blue-600" : "text-orange-600"
                  )}>
                    {preview.net_surplus >= 0 ? "Net Surplus" : "Net Deficit"}
                  </p>
                  <p className={cn(
                    "text-base font-bold",
                    preview.net_surplus >= 0 ? "text-blue-800" : "text-orange-800"
                  )}>
                    {PKR(Math.abs(preview.net_surplus))}
                  </p>
                </div>
              </div>

              {/* Balance accounts */}
              {preview.balance_accounts.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Opening Balances for FY{preview.fiscal_year + 1}
                    <span className="ml-1 text-gray-400 font-normal">
                      ({preview.opening_entries_to_create} entries)
                    </span>
                  </h3>
                  <div className="border border-gray-100 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Code</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Account</th>
                          <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                          <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Balance</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {preview.balance_accounts.map((a) => (
                          <tr key={a.code} className="hover:bg-gray-50">
                            <td className="px-3 py-2 font-mono text-xs text-gray-500">{a.code}</td>
                            <td className="px-3 py-2 text-gray-700">{a.name}</td>
                            <td className="px-3 py-2 text-xs text-gray-400">{a.type}</td>
                            <td className={cn(
                              "px-3 py-2 text-right font-semibold",
                              a.closing_balance < 0 ? "text-red-600" : "text-gray-800"
                            )}>
                              {PKR(a.closing_balance)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Note field */}
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">
                  Closing Note (optional)
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Audited and approved by committee"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Warning */}
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 text-sm text-amber-800">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  Closing FY{preview.fiscal_year} will create {preview.opening_entries_to_create} opening
                  balance entries dated 1 Jul {preview.fiscal_year} and book the net{" "}
                  {preview.net_surplus >= 0 ? "surplus" : "deficit"} to GF.
                  This cannot be undone.
                </span>
              </div>

              {msg && (
                <div className={cn(
                  "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg",
                  msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
                )}>
                  {msg.ok && <CheckCircle className="w-4 h-4" />}
                  {msg.text}
                </div>
              )}

              <button
                onClick={() => setConfirmOpen(true)}
                disabled={closing}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {closing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
                {closing ? "Processing…" : `Close FY${selectedYear}`}
              </button>
            </div>
          ) : msg ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
              <div className={cn(
                "flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg",
                msg.ok ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600"
              )}>
                {msg.text}
              </div>
            </div>
          ) : null}
        </div>

        {/* ── Right: Closed years list ─────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5">
            <div className="flex items-center gap-2 mb-4">
              <Archive className="w-4 h-4 text-gray-400" />
              <h2 className="text-sm font-semibold text-gray-700">Closed Fiscal Years</h2>
            </div>
            {closedYears.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No years closed yet</p>
            ) : (
              <div className="space-y-2">
                {closedYears.map((c) => (
                  <div
                    key={c.id}
                    className="flex items-center justify-between p-2.5 bg-gray-50 rounded-lg border border-gray-100"
                  >
                    <div>
                      <div className="flex items-center gap-1.5">
                        <Lock className="w-3 h-3 text-gray-400" />
                        <span className="text-sm font-semibold text-gray-800">FY{c.fiscal_year}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">Closed {fmtDate(c.closed_at)}</p>
                    </div>
                    <div className="text-right">
                      <span className={cn(
                        "text-xs font-medium",
                        c.net_surplus >= 0 ? "text-emerald-600" : "text-red-600"
                      )}>
                        {c.net_surplus >= 0 ? "+" : ""}{PKR(c.net_surplus)}
                      </span>
                      <p className="text-xs text-gray-400">{c.opening_entries_count} opening entries</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── Confirm dialog ────────────────────────────────────────────────────── */}
      {confirmOpen && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                <Lock className="w-5 h-5 text-red-600" />
              </div>
              <h2 className="text-lg font-bold text-gray-900">Close FY{selectedYear}?</h2>
            </div>
            <p className="text-sm text-gray-600">
              This will permanently lock all entries dated 1 Jul {selectedYear - 1} – 30 Jun {selectedYear}
              and create opening balance entries for FY{selectedYear + 1}.
              This action cannot be undone.
            </p>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setConfirmOpen(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleClose}
                className="flex-1 px-4 py-2 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold rounded-lg"
              >
                Yes, Close Year
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
