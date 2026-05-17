import { useState, useRef, useCallback } from "react";
import {
  Upload, CheckCircle, XCircle, FileSpreadsheet, AlertTriangle,
  ChevronDown, ChevronUp, Loader2, RefreshCw, ShieldCheck,
  PlusCircle, RotateCcw, Archive, AlertCircle,
} from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const TYPE_COLOR = {
  ASSET:     "bg-blue-100 text-blue-800",
  LIABILITY: "bg-red-100 text-red-800",
  INCOME:    "bg-emerald-100 text-emerald-800",
  EXPENSE:   "bg-amber-100 text-amber-800",
  EQUITY:    "bg-purple-100 text-purple-800",
  UNKNOWN:   "bg-gray-100 text-gray-600",
};

function fmt(n) {
  return Number(n ?? 0).toLocaleString();
}

function fmtSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          "px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto max-w-xs",
          t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function StatBadge({ label, value, color = "bg-slate-100 text-slate-800", icon: Icon }) {
  return (
    <div className={cn("rounded-lg px-4 py-3 text-center", color)}>
      {Icon && <Icon className="w-4 h-4 mx-auto mb-1 opacity-60" />}
      <p className="text-2xl font-bold">{value}</p>
      <p className="text-xs font-medium mt-0.5 opacity-80">{label}</p>
    </div>
  );
}

function TrustBadge({ trust }) {
  return (
    <div className="flex items-center gap-2">
      <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0" />
      <span className="px-2 py-0.5 bg-emerald-50 border border-emerald-200 rounded text-xs font-bold text-emerald-700">
        {trust.code}
      </span>
      <span className="text-sm text-gray-600 truncate">{trust.name}</span>
    </div>
  );
}

function AccountTable({ accounts, expanded, onToggle, showSync }) {
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
      >
        <span>Accounts ({accounts.length})</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="px-3 py-2 text-left">Sheet</th>
                <th className="px-3 py-2 text-left">Code</th>
                <th className="px-3 py-2 text-left">Name</th>
                <th className="px-3 py-2 text-left">Type</th>
                <th className="px-3 py-2 text-right">Txns</th>
                {showSync && <>
                  <th className="px-3 py-2 text-right text-emerald-300">New</th>
                  <th className="px-3 py-2 text-right text-blue-300">Upd</th>
                  <th className="px-3 py-2 text-right text-amber-300">Flag</th>
                </>}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {accounts.map((a, i) => (
                <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                  <td className="px-3 py-2 font-mono text-gray-500">{a.sheet}</td>
                  <td className="px-3 py-2 font-mono font-semibold text-gray-800">{a.account_code}</td>
                  <td className="px-3 py-2 text-gray-700">{a.account_name}</td>
                  <td className="px-3 py-2">
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium",
                      TYPE_COLOR[a.account_type] ?? TYPE_COLOR.UNKNOWN)}>
                      {a.account_type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-right font-mono">{fmt(a.transaction_count ?? (a.inserted ?? 0) + (a.updated ?? 0))}</td>
                  {showSync && <>
                    <td className="px-3 py-2 text-right font-mono text-emerald-700">
                      {(a.est_inserts ?? a.inserted ?? 0) > 0 ? fmt(a.est_inserts ?? a.inserted) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-blue-600">
                      {(a.est_updates ?? a.updated ?? 0) > 0 ? fmt(a.est_updates ?? a.updated) : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-3 py-2 text-right font-mono text-amber-600">
                      {(a.est_flags ?? a.flagged ?? 0) > 0 ? fmt(a.est_flags ?? a.flagged) : <span className="text-gray-300">—</span>}
                    </td>
                  </>}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function TenantList({ tenants, expanded, onToggle }) {
  if (!tenants.length) return null;
  return (
    <div className="border border-gray-200 rounded-lg overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-2.5 bg-gray-50 hover:bg-gray-100 text-sm font-medium text-gray-700 transition-colors"
      >
        <span>Tenants to extract ({tenants.length})</span>
        {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {expanded && (
        <div className="px-4 py-3 flex flex-wrap gap-2">
          {tenants.map((t, i) => (
            <span key={i} className="px-2 py-1 bg-emerald-50 border border-emerald-200 rounded text-xs text-emerald-800 font-medium">
              {t.name}
              {t.plot_code && <span className="text-emerald-500 ml-1">@{t.plot_code}</span>}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function TrustSelector({ trusts, value, onChange, onConfirm, label }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
      >
        <option value="">Select trust…</option>
        {trusts.map((t) => (
          <option key={t.id} value={t.id}>{t.code} — {t.name}</option>
        ))}
      </select>
      <button
        onClick={onConfirm}
        disabled={!value}
        className="px-4 py-2 bg-slate-700 hover:bg-slate-800 text-white text-sm font-semibold rounded-lg disabled:opacity-50 transition-colors"
      >
        {label}
      </button>
    </div>
  );
}

// ── Sync result log ───────────────────────────────────────────────────────────

function SyncLog({ log, errors }) {
  return (
    <div className="space-y-1 max-h-80 overflow-y-auto">
      {log.map((entry, i) => (
        entry.type === "skip" ? (
          <div key={i} className="flex items-center gap-2 text-xs px-3 py-1.5 rounded bg-gray-50 text-gray-500">
            <span className="w-4 h-4 flex items-center justify-center rounded-full bg-gray-200 text-gray-600 shrink-0">–</span>
            <span className="font-mono">{entry.sheet}</span>
            <span>skipped (summary sheet)</span>
          </div>
        ) : (
          <div key={i} className="flex flex-wrap items-center gap-2 text-xs px-3 py-1.5 rounded bg-gray-50">
            <CheckCircle className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
            <span className="font-mono font-semibold w-20 shrink-0 text-gray-800">{entry.account_code}</span>
            <span className="text-gray-500 flex-1 min-w-0 truncate">{entry.account_name}</span>
            {(entry.inserted ?? 0) > 0 && (
              <span className="bg-emerald-100 text-emerald-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                +{fmt(entry.inserted)} new
              </span>
            )}
            {(entry.updated ?? 0) > 0 && (
              <span className="bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                ~{fmt(entry.updated)} upd
              </span>
            )}
            {(entry.flagged ?? 0) > 0 && (
              <span className="bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded whitespace-nowrap">
                ⚑{fmt(entry.flagged)} flagged
              </span>
            )}
          </div>
        )
      ))}
      {errors.map((err, i) => (
        <div key={`err-${i}`} className="flex items-start gap-2 text-xs px-3 py-1.5 rounded bg-red-50 text-red-700">
          <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{err}</span>
        </div>
      ))}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function ImportExcelPage() {
  const fileRef = useRef(null);

  const [file,             setFile]             = useState(null);
  const [dragging,         setDragging]         = useState(false);
  const [detecting,        setDetecting]        = useState(false);
  const [detection,        setDetection]        = useState(null);
  const [showOverride,     setShowOverride]      = useState(false);
  const [overrideTrustId,  setOverrideTrustId]  = useState("");
  const [confirmedTrust,   setConfirmedTrust]   = useState(null);
  const [previewing,       setPreviewing]       = useState(false);
  const [importing,        setImporting]        = useState(false);
  const [preview,          setPreview]          = useState(null);
  const [result,           setResult]           = useState(null);
  const [showAccounts,     setShowAccounts]     = useState(true);
  const [showTenants,      setShowTenants]      = useState(false);
  const [showWarnings,     setShowWarnings]     = useState(false);
  const [warnings,         setWarnings]         = useState([]);
  const [toasts,           setToasts]           = useState([]);

  const addToast = useCallback((msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 4000);
  }, []);

  async function pickFile(f) {
    if (!f) return;
    if (!f.name.toLowerCase().match(/\.xlsx?$/))
      return addToast("Only .xls and .xlsx files are supported", "error");
    setFile(f);
    setDetection(null);
    setConfirmedTrust(null);
    setPreview(null);
    setResult(null);
    setShowOverride(false);
    setOverrideTrustId("");
    setWarnings([]);

    setDetecting(true);
    const fd = new FormData();
    fd.append("file", f);
    try {
      const res = await fetch(`${API}/api/import/detect-trust`, { method: "POST", body: fd });
      if (!res.ok) throw new Error("Detection request failed");
      setDetection(await res.json());
    } catch {
      setDetection({ confidence: "none", detected_name: null, matched_trust_id: null,
        matched_trust_code: null, matched_trust_name: null, all_trusts: [] });
      addToast("Could not auto-detect trust — please select manually", "error");
    } finally {
      setDetecting(false);
    }
  }

  function handleDrop(e) {
    e.preventDefault();
    setDragging(false);
    pickFile(e.dataTransfer.files[0]);
  }

  function reset() {
    setFile(null); setDetection(null); setConfirmedTrust(null);
    setPreview(null); setResult(null); setShowOverride(false);
    setOverrideTrustId(""); setWarnings([]);
    if (fileRef.current) fileRef.current.value = "";
  }

  function confirmDetected() {
    setConfirmedTrust({ id: detection.matched_trust_id, code: detection.matched_trust_code,
      name: detection.matched_trust_name });
    setShowOverride(false);
  }

  function confirmOverride() {
    const trust = (detection?.all_trusts ?? []).find((t) => String(t.id) === overrideTrustId);
    if (trust) { setConfirmedTrust({ id: trust.id, code: trust.code, name: trust.name }); setShowOverride(false); }
  }

  function changeTrust() {
    setConfirmedTrust(null); setPreview(null); setShowOverride(true);
  }

  async function handlePreview() {
    if (!file || !confirmedTrust) return;
    setPreviewing(true);
    setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("trust_id", confirmedTrust.id);
    try {
      const res = await fetch(`${API}/api/import/preview`, { method: "POST", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? "Preview failed"); }
      setPreview(await res.json());
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setPreviewing(false);
    }
  }

  async function handleImport() {
    if (!file || !confirmedTrust) return;
    setImporting(true);
    setResult(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("trust_id", confirmedTrust.id);
    try {
      const res = await fetch(`${API}/api/import/execute`, { method: "POST", body: fd });
      if (!res.ok) { const err = await res.json().catch(() => ({})); throw new Error(err.detail ?? "Import failed"); }
      const data = await res.json();
      setResult(data);
      addToast(
        `Sync complete: +${data.transactions_inserted} new, ~${data.transactions_updated} updated` +
        (data.transactions_flagged > 0 ? `, ⚑${data.transactions_flagged} flagged` : "")
      );
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setImporting(false);
    }
  }

  async function fetchWarnings() {
    if (!confirmedTrust) return;
    setShowWarnings(true);
    try {
      const res = await fetch(`${API}/api/import/warnings?trust_id=${confirmedTrust.id}`);
      if (res.ok) setWarnings(await res.json());
    } catch { /* silent */ }
  }

  const canPreview = !!(file && confirmedTrust && !previewing && !importing);
  const canImport  = !!(file && confirmedTrust && preview && !importing && !previewing && !result);
  const sa = preview?.sync_analysis;

  return (
    <div className="space-y-5">
      <Toast toasts={toasts} />

      {/* ── Drop zone ────────────────────────────────────────────────────── */}
      {!file && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current?.click()}
          className={cn(
            "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors",
            dragging ? "border-emerald-400 bg-emerald-50" : "border-gray-300 hover:border-emerald-400 hover:bg-gray-50"
          )}
        >
          <input ref={fileRef} type="file" accept=".xls,.xlsx" className="hidden"
            onChange={(e) => pickFile(e.target.files[0])} />
          <FileSpreadsheet className="w-14 h-14 mx-auto mb-4 text-gray-300" />
          <p className="text-base font-semibold text-gray-700">Drop your WPF ledger file here</p>
          <p className="text-sm text-gray-400 mt-1">or click to browse — supports .xls and .xlsx</p>
          <p className="text-xs text-gray-400 mt-3">Smart sync: existing data is updated, not duplicated</p>
        </div>
      )}

      {/* ── Detecting spinner ─────────────────────────────────────────────── */}
      {detecting && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
          <p className="text-sm text-gray-600">Reading file and detecting trust…</p>
          <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">Cancel</button>
        </div>
      )}

      {/* ── Trust detection card ──────────────────────────────────────────── */}
      {detection && !confirmedTrust && !detecting && (
        detection.confidence === "high" ? (
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-emerald-500 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <CheckCircle className="w-5 h-5 text-emerald-600 mt-0.5 shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-gray-900">Trust detected from file</p>
                <p className="text-sm text-gray-700 mt-0.5">
                  <span className="font-mono font-bold text-emerald-700">{detection.matched_trust_code}</span>
                  {" — "}{detection.matched_trust_name}
                </p>
                {detection.detected_name && (
                  <p className="text-xs text-gray-400 mt-1">Read from file: &ldquo;{detection.detected_name}&rdquo;</p>
                )}
              </div>
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button onClick={confirmDetected}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors">
                Yes, use {detection.matched_trust_code}
              </button>
              <button onClick={() => setShowOverride((v) => !v)}
                className="text-sm text-gray-500 hover:text-gray-700 transition-colors">
                {showOverride ? "Cancel" : "Use different trust"}
              </button>
            </div>
            {showOverride && (
              <div className="mt-3">
                <TrustSelector trusts={detection.all_trusts ?? []} value={overrideTrustId}
                  onChange={setOverrideTrustId} onConfirm={confirmOverride} label="Use selected" />
              </div>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-gray-200 border-l-4 border-l-amber-400 shadow-sm p-5">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-gray-900">Trust could not be detected</p>
                {detection.detected_name
                  ? <p className="text-xs text-gray-500 mt-0.5">Read: &ldquo;{detection.detected_name}&rdquo; — no match</p>
                  : <p className="text-xs text-gray-500 mt-0.5">No trust name found in TB, IS or BS sheets.</p>}
              </div>
            </div>
            <div className="mt-4">
              <p className="text-xs font-medium text-gray-700 mb-2">Select the correct trust to continue</p>
              <TrustSelector trusts={detection.all_trusts ?? []} value={overrideTrustId}
                onChange={setOverrideTrustId} onConfirm={confirmOverride} label="Use this trust" />
            </div>
            <div className="mt-3 flex justify-end">
              <button onClick={reset} className="text-xs text-gray-400 hover:text-gray-600">
                Cancel — choose a different file
              </button>
            </div>
          </div>
        )
      )}

      {/* ── File card (trust confirmed) ───────────────────────────────────── */}
      {file && confirmedTrust && !result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-3 pb-3 border-b border-gray-100">
            <TrustBadge trust={confirmedTrust} />
            <button onClick={changeTrust} className="ml-auto text-xs text-gray-400 hover:text-gray-600">
              Change trust
            </button>
          </div>
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center shrink-0">
              <FileSpreadsheet className="w-6 h-6 text-emerald-600" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-gray-900 truncate">{file.name}</p>
              <p className="text-xs text-gray-400 mt-0.5">{fmtSize(file.size)}</p>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <button onClick={handlePreview} disabled={!canPreview}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-800 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                {previewing ? <><Loader2 className="w-4 h-4 animate-spin" /> Analyzing…</> : <><Upload className="w-4 h-4" /> Analyze</>}
              </button>
              <button onClick={handleImport} disabled={!canImport}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium disabled:opacity-50 transition-colors">
                {importing ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</> : <>Sync Import</>}
              </button>
              <button onClick={reset} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600" title="Clear">
                <XCircle className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Preview / analysis panel ──────────────────────────────────────── */}
      {preview && !result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 p-5">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-gray-900">Sync Analysis</h2>
            {preview.sheets_skipped.length > 0 && (
              <span className="text-xs text-gray-400">
                ({preview.sheets_skipped.length} summary sheet{preview.sheets_skipped.length !== 1 ? "s" : ""} skipped)
              </span>
            )}
          </div>

          {/* Sync breakdown */}
          {sa ? (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <StatBadge label="New entries"   value={fmt(sa.estimated_inserts)} color="bg-emerald-50 text-emerald-800" icon={PlusCircle} />
              <StatBadge label="Will update"   value={fmt(sa.estimated_updates)} color="bg-blue-50 text-blue-800"     icon={RotateCcw} />
              <StatBadge label="Will flag"     value={fmt(sa.estimated_flags)}   color="bg-amber-50 text-amber-800"   icon={Archive} />
              <StatBadge label="Tenants"       value={preview.tenants_found}     color="bg-violet-50 text-violet-800" />
            </div>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              <StatBadge label="Accounts"     value={preview.accounts_found}          color="bg-slate-100 text-slate-800" />
              <StatBadge label="Transactions" value={fmt(preview.transactions_found)} color="bg-blue-50 text-blue-800" />
              <StatBadge label="Tenants"      value={preview.tenants_found}           color="bg-emerald-50 text-emerald-800" />
            </div>
          )}

          <AccountTable accounts={preview.accounts} expanded={showAccounts}
            onToggle={() => setShowAccounts((v) => !v)} showSync={!!sa} />
          <TenantList tenants={preview.tenants} expanded={showTenants}
            onToggle={() => setShowTenants((v) => !v)} />

          <div className="flex justify-end pt-1">
            <button onClick={handleImport} disabled={!canImport}
              className="flex items-center gap-2 px-6 py-2.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold disabled:opacity-50 transition-colors">
              {importing
                ? <><Loader2 className="w-4 h-4 animate-spin" /> Syncing…</>
                : <>Sync {fmt(preview.transactions_found)} Transactions</>}
            </button>
          </div>
        </div>
      )}

      {/* ── Import result panel ───────────────────────────────────────────── */}
      {result && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm space-y-4 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-3 min-w-0">
              <h2 className="text-sm font-semibold text-gray-900 shrink-0">Sync Complete</h2>
              {confirmedTrust && <TrustBadge trust={confirmedTrust} />}
            </div>
            <button onClick={reset}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 font-medium shrink-0">
              <RefreshCw className="w-3.5 h-3.5" /> Import another file
            </button>
          </div>

          {/* Transaction sync stats — colour-coded */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge
              label="New Transactions"
              value={fmt(result.transactions_inserted)}
              color="bg-emerald-50 text-emerald-800"
              icon={PlusCircle}
            />
            <StatBadge
              label="Updated"
              value={fmt(result.transactions_updated)}
              color="bg-blue-50 text-blue-800"
              icon={RotateCcw}
            />
            <StatBadge
              label="Flagged (missing)"
              value={fmt(result.transactions_flagged)}
              color={result.transactions_flagged > 0 ? "bg-amber-50 text-amber-800" : "bg-gray-50 text-gray-500"}
              icon={Archive}
            />
            <StatBadge
              label="Warnings"
              value={fmt(result.validation_warnings)}
              color={result.validation_warnings > 0 ? "bg-red-50 text-red-800" : "bg-gray-50 text-gray-500"}
              icon={AlertCircle}
            />
          </div>

          {/* Tenant stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatBadge label="Accts Created"  value={result.accounts_created}  color="bg-slate-100 text-slate-700" />
            <StatBadge label="Accts Updated"  value={result.accounts_updated}  color="bg-slate-100 text-slate-700" />
            <StatBadge label="Tenants Added"  value={result.tenants_added}     color="bg-violet-50 text-violet-800" />
            <StatBadge label="Tenants Updated" value={result.tenants_updated ?? 0} color="bg-violet-50 text-violet-700" />
          </div>

          {/* Flagged notice */}
          {result.transactions_flagged > 0 && (
            <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
              <Archive className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                <strong>{fmt(result.transactions_flagged)} transactions</strong> were in the database but not in this file.
                They are flagged as deleted but preserved — review via <code className="font-mono text-xs">/api/import/flagged</code>.
              </span>
            </div>
          )}

          {/* View warnings button */}
          {result.validation_warnings > 0 && (
            <div className="border border-red-200 rounded-lg overflow-hidden">
              <button
                onClick={() => (showWarnings ? setShowWarnings(false) : fetchWarnings())}
                className="w-full flex items-center justify-between px-4 py-2.5 bg-red-50 hover:bg-red-100 text-sm font-medium text-red-700 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4" />
                  {result.validation_warnings} validation warning{result.validation_warnings !== 1 ? "s" : ""} — click to review
                </span>
                {showWarnings ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showWarnings && warnings.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-red-100 text-red-800">
                        <th className="px-3 py-2 text-left">Account</th>
                        <th className="px-3 py-2 text-left">Date</th>
                        <th className="px-3 py-2 text-left">Ref</th>
                        <th className="px-3 py-2 text-left">Particulars</th>
                        <th className="px-3 py-2 text-left">Warnings</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-red-100">
                      {warnings.map((w, i) => (
                        <tr key={i} className={i % 2 === 0 ? "bg-white" : "bg-red-50"}>
                          <td className="px-3 py-2 font-mono font-semibold">{w.account_code}</td>
                          <td className="px-3 py-2 text-red-700">{w.date}</td>
                          <td className="px-3 py-2 text-gray-500">{w.receipt_no || "—"}</td>
                          <td className="px-3 py-2 text-gray-600 max-w-xs truncate">{w.particulars || "—"}</td>
                          <td className="px-3 py-2">
                            {w.warnings.map((code, j) => (
                              <span key={j} className="mr-1 px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                                {code}
                              </span>
                            ))}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* Errors */}
          {result.errors?.length > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-xs font-semibold text-red-700 mb-1">{result.errors.length} error(s)</p>
              <div className="space-y-0.5 max-h-32 overflow-y-auto">
                {result.errors.map((e, i) => <p key={i} className="text-xs text-red-600">{e}</p>)}
              </div>
            </div>
          )}

          {/* Per-account log */}
          <SyncLog log={result.log} errors={[]} />
        </div>
      )}

      {/* ── Format reference (only when no file loaded) ───────────────────── */}
      {!file && (
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-5">
          <p className="text-sm font-semibold text-slate-800 mb-3">Smart Sync Import</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs text-slate-600">
            <div>
              <p className="font-medium text-slate-700 mb-1.5">Sync behaviour</p>
              <ul className="space-y-1">
                <li className="flex items-start gap-2"><span className="text-emerald-600 font-bold mt-0.5">+</span> New rows in file → INSERT</li>
                <li className="flex items-start gap-2"><span className="text-blue-600 font-bold mt-0.5">~</span> Same row in file + DB → UPDATE changed fields</li>
                <li className="flex items-start gap-2"><span className="text-amber-600 font-bold mt-0.5">⚑</span> Row in DB but not file → flag is_deleted (not deleted)</li>
                <li className="flex items-start gap-2"><span className="text-violet-600 font-bold mt-0.5">T</span> Tenants re-extracted and upserted after each import</li>
                <li className="flex items-start gap-2"><span className="text-red-600 font-bold mt-0.5">!</span> Date issues flagged as validation warnings</li>
              </ul>
            </div>
            <div>
              <p className="font-medium text-slate-700 mb-1.5">Match key (per entry)</p>
              <code className="block bg-slate-100 rounded px-3 py-2 font-mono text-slate-700">
                MD5(trust_id | account_code | particulars[:50])
              </code>
              <p className="mt-2 text-slate-500">
                Same account + same description = same row. Re-importing corrects date, amount, reference, and tenant without duplication.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
