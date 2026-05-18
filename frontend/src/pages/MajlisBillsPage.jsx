import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, BookOpen, AlertCircle, ChevronDown, ChevronUp, Pencil, X, AlertTriangle } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const HIJRI_MONTHS = [
  "Muharram", "Safar", "Rabi al-Awwal", "Rabi al-Thani",
  "Jumada al-Awwal", "Jumada al-Thani", "Rajab", "Sha'ban",
  "Ramadan", "Shawwal", "Dhu al-Qi'dah", "Dhu al-Hijjah",
];

const TODAY = new Date().toISOString().slice(0, 10);

const CASH_STATUS_STYLE = {
  PAID:    "bg-emerald-100 text-emerald-700",
  SHORT:   "bg-amber-100 text-amber-700",
  ADVANCE: "bg-gray-100 text-gray-500",
  NIL:     "bg-gray-100 text-gray-500",
};

const EMPTY = {
  date: TODAY,
  debitAccount: "CASH",
  cashReceived: "",
  noCash: false,
  hijri_day: "",
  hijri_month: "",
  hijri_year: "",
  from_time: "",
  to_time: "",
  event_name: "",
  milk_qty: "",
  milk_price: "",
  sugar_qty: "",
  sugar_price: "",
  tea_qty: "",
  tea_price: "",
  saffron: "",
  cardamoms: "",
  pistachios: "",
  ice: "",
  essence: "",
  miscellaneous: "",
  miscellaneous_desc: "",
  lights_fans: "",
  gas: "",
  loud_speaker: "",
  molana: "",
};

function n(v) { return parseFloat(v) || 0; }

function calcTotal(f) {
  return (
    n(f.milk_qty) * n(f.milk_price) +
    n(f.sugar_qty) * n(f.sugar_price) +
    n(f.tea_qty) * n(f.tea_price) +
    n(f.saffron) + n(f.cardamoms) + n(f.pistachios) +
    n(f.ice) + n(f.essence) + n(f.miscellaneous) +
    n(f.lights_fans) + n(f.gas) + n(f.loud_speaker) + n(f.molana)
  );
}

function fmtDate(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div
          key={t.id}
          className={cn(
            "px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto",
            t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          )}
        >
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ bill, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <h3 className="font-semibold text-gray-900">Delete Bill?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Bill #{bill.serial_no} for <strong>{bill.event_name || "—"}</strong> ({fmtDate(bill.date)}) will be permanently deleted along with its journal entries.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete</button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children, className }) {
  return (
    <div className={className}>
      <label className="block text-xs font-medium text-gray-700 mb-1">{label}</label>
      {children}
    </div>
  );
}

function NumInput({ value, onChange, placeholder = "0" }) {
  return (
    <input
      type="number"
      min="0"
      step="0.01"
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
    />
  );
}

function StatCard({ label, value, sub }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-1">{label}</p>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </div>
  );
}

export default function MajlisBillsPage() {
  const { selectedTrust } = useTrust();
  const [bills, setBills] = useState([]);
  const [nextSerial, setNextSerial] = useState("001");
  const [cashAccounts, setCashAccounts] = useState([]);
  const [outstandingBills, setOutstandingBills] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [showForm, setShowForm] = useState(true);
  const [editingId, setEditingId] = useState(null);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const set = (key) => (e) => setForm((f) => ({ ...f, [key]: e.target.value }));

  const fetchBills = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/majlis?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      setBills(await res.json());
    } catch {
      addToast("Failed to load bills", "error");
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  const fetchSerial = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/majlis/next-serial?trust_id=${selectedTrust.id}`);
      if (res.ok) setNextSerial((await res.json()).serial_no);
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchCashAccounts = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/rent/cash-accounts?trust_id=${selectedTrust.id}`);
      if (res.ok) setCashAccounts(await res.json());
    } catch { /* silent */ }
  }, [selectedTrust]);

  const fetchOutstanding = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/api/majlis/receivables?trust_id=${selectedTrust.id}`);
      if (res.ok) setOutstandingBills(await res.json());
    } catch { /* silent */ }
  }, [selectedTrust]);

  useEffect(() => {
    fetchBills();
    fetchSerial();
    fetchCashAccounts();
    fetchOutstanding();
  }, [fetchBills, fetchSerial, fetchCashAccounts, fetchOutstanding]);

  function startEdit(b) {
    const isNoCash = b.cash_status === "ADVANCE" || b.cash_received === 0;
    setForm({
      date: b.date,
      debitAccount: cashAccounts[0]?.account_code ?? "CASH",
      cashReceived: isNoCash ? "" : (
        b.cash_received != null && b.cash_received !== b.total_amount
          ? String(b.cash_received) : ""
      ),
      noCash: isNoCash,
      hijri_day: b.hijri_day || "",
      hijri_month: b.hijri_month || "",
      hijri_year: b.hijri_year || "",
      from_time: b.from_time || "",
      to_time: b.to_time || "",
      event_name: b.event_name || "",
      milk_qty: b.milk_qty || "",
      milk_price: b.milk_price || "",
      sugar_qty: b.sugar_qty || "",
      sugar_price: b.sugar_price || "",
      tea_qty: b.tea_qty || "",
      tea_price: b.tea_price || "",
      saffron: b.saffron || "",
      cardamoms: b.cardamoms || "",
      pistachios: b.pistachios || "",
      ice: b.ice || "",
      essence: b.essence || "",
      miscellaneous: b.miscellaneous || "",
      miscellaneous_desc: b.miscellaneous_desc || "",
      lights_fans: b.lights_fans || "",
      gas: b.gas || "",
      loud_speaker: b.loud_speaker || "",
      molana: b.molana || "",
    });
    setEditingId(b.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    setForm(EMPTY);
    setEditingId(null);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!selectedTrust) return;
    setSubmitting(true);
    const actualCashReceived = form.noCash
      ? 0
      : (form.cashReceived !== "" ? parseFloat(form.cashReceived) : total);

    const payload = {
      trust_id: selectedTrust.id,
      date: form.date,
      debit_account_code: form.debitAccount || "CASH",
      cash_received: actualCashReceived,
      hijri_day: form.hijri_day || null,
      hijri_month: form.hijri_month || null,
      hijri_year: form.hijri_year || null,
      from_time: form.from_time || null,
      to_time: form.to_time || null,
      event_name: form.event_name || null,
      milk_qty: n(form.milk_qty),
      milk_price: n(form.milk_price),
      sugar_qty: n(form.sugar_qty),
      sugar_price: n(form.sugar_price),
      tea_qty: n(form.tea_qty),
      tea_price: n(form.tea_price),
      saffron: n(form.saffron),
      cardamoms: n(form.cardamoms),
      pistachios: n(form.pistachios),
      ice: n(form.ice),
      essence: n(form.essence),
      miscellaneous: n(form.miscellaneous),
      miscellaneous_desc: form.miscellaneous_desc || null,
      lights_fans: n(form.lights_fans),
      gas: n(form.gas),
      loud_speaker: n(form.loud_speaker),
      molana: n(form.molana),
    };
    try {
      const url = editingId ? `${API}/api/majlis/${editingId}` : `${API}/api/majlis`;
      const method = editingId ? "PUT" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast(editingId ? "Bill updated" : "Bill recorded successfully");
      setForm(EMPTY);
      setEditingId(null);
      fetchBills();
      fetchSerial();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    try {
      const res = await fetch(`${API}/api/majlis/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      setBills((p) => p.filter((b) => b.id !== deleteTarget.id));
      addToast("Bill deleted");
      fetchSerial();
      if (editingId === deleteTarget.id) cancelEdit();
    } catch {
      addToast("Failed to delete", "error");
    } finally {
      setDeleteTarget(null);
    }
  }

  const total = calcTotal(form);
  const loudSpeaker = n(form.loud_speaker);
  const billExceptLS = total - loudSpeaker;

  // Stat card totals
  const statMSub = bills.reduce((s, b) => s + ((b.total_amount || 0) - (b.loud_speaker || 0)), 0);
  const statLChgs = bills.reduce((s, b) => s + (b.loud_speaker || 0), 0);
  const statTotal = bills.reduce((s, b) => s + (b.total_amount || 0), 0);

  return (
    <div className="space-y-6">
      <Toast toasts={toasts} />
      {deleteTarget && (
        <ConfirmDialog bill={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}

      {/* ── Stat Cards ────────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 animate-pulse">
              <div className="h-3 bg-gray-200 rounded w-24 mb-2" />
              <div className="h-7 bg-gray-200 rounded w-20" />
            </div>
          ))
        ) : (
          <>
            <StatCard label="Total Bills" value={bills.length} />
            <StatCard label="M-SUB Received" value={PKR(statMSub)} sub="Majlis subscription" />
            <StatCard label="L-CHGS Received" value={PKR(statLChgs)} sub="Loud speaker charges" />
            <StatCard label="Grand Total" value={PKR(statTotal)} sub="All bills combined" />
          </>
        )}
      </div>

      {/* ── Entry / Edit Form ─────────────────────────────────────────────── */}
      <div className={cn(
        "bg-white rounded-xl shadow-sm border",
        editingId ? "border-blue-300 ring-1 ring-blue-200" : "border-gray-200"
      )}>
        <button
          type="button"
          onClick={() => { if (!editingId) setShowForm((s) => !s); }}
          className="w-full flex items-center gap-3 px-6 py-4 border-b border-gray-100 text-left"
        >
          <BookOpen className={cn("w-5 h-5", editingId ? "text-blue-600" : "text-emerald-600")} />
          <h2 className="text-base font-semibold text-gray-900 flex-1">
            {editingId ? `Edit Bill` : "New Majlis Bill"}
          </h2>
          {!editingId && (
            <span className="text-xs text-gray-400 font-mono bg-gray-100 px-2 py-1 rounded">#{nextSerial}</span>
          )}
          {editingId ? null : showForm
            ? <ChevronUp className="w-4 h-4 text-gray-400" />
            : <ChevronDown className="w-4 h-4 text-gray-400" />
          }
        </button>

        {(showForm || editingId) && (
          <form onSubmit={handleSubmit} className="p-6 space-y-5">
            {/* Outstanding bills alert */}
            {!editingId && outstandingBills.length > 0 && (
              <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 flex gap-3">
                <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-semibold text-amber-800">
                    {outstandingBills.length} outstanding bill(s) — total due: {PKR(outstandingBills.reduce((s, b) => s + (b.shortfall ?? 0), 0))}
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-xs text-amber-700">
                    {outstandingBills.slice(0, 5).map(b => (
                      <li key={b.id}>#{b.serial_no} {b.event_name ? `— ${b.event_name}` : ""} — Balance: {PKR(b.shortfall)} ({b.cash_status})</li>
                    ))}
                    {outstandingBills.length > 5 && <li>…and {outstandingBills.length - 5} more</li>}
                  </ul>
                </div>
              </div>
            )}

            {/* Date + Event + Time + Debit Account */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Field label="Date *">
                <input type="date" value={form.date} onChange={set("date")} required
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
              <Field label="Event / Donor Name">
                <input type="text" value={form.event_name} onChange={set("event_name")} placeholder="Name"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
              <Field label="Time">
                <div className="flex gap-2">
                  <input type="text" value={form.from_time} onChange={set("from_time")} placeholder="From"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                  <input type="text" value={form.to_time} onChange={set("to_time")} placeholder="To"
                    className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </div>
              </Field>
              <Field label="Debit Account (DR)">
                <select value={form.debitAccount} onChange={set("debitAccount")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  {cashAccounts.length === 0 && <option value="CASH">CASH</option>}
                  {cashAccounts.map((a) => (
                    <option key={a.account_code} value={a.account_code}>
                      {a.account_code} — {a.account_name}
                    </option>
                  ))}
                </select>
              </Field>
            </div>

            {/* Hijri date */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Hijri Day">
                <input type="number" min="1" max="30" value={form.hijri_day} onChange={set("hijri_day")} placeholder="1–30"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
              <Field label="Hijri Month">
                <select value={form.hijri_month} onChange={set("hijri_month")}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                  <option value="">Select…</option>
                  {HIJRI_MONTHS.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
              </Field>
              <Field label="Hijri Year">
                <input type="number" min="1400" max="1500" value={form.hijri_year} onChange={set("hijri_year")} placeholder="e.g. 1446"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
              </Field>
            </div>

            {/* Beverages section */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Beverages</p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-600">Milk</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Qty (L)</label>
                      <NumInput value={form.milk_qty} onChange={set("milk_qty")} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Price/L</label>
                      <NumInput value={form.milk_price} onChange={set("milk_price")} />
                    </div>
                  </div>
                  <p className="text-xs text-right text-emerald-700 font-medium">{PKR(n(form.milk_qty) * n(form.milk_price))}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-600">Sugar</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Qty (kg)</label>
                      <NumInput value={form.sugar_qty} onChange={set("sugar_qty")} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Price/kg</label>
                      <NumInput value={form.sugar_price} onChange={set("sugar_price")} />
                    </div>
                  </div>
                  <p className="text-xs text-right text-emerald-700 font-medium">{PKR(n(form.sugar_qty) * n(form.sugar_price))}</p>
                </div>
                <div className="p-3 bg-gray-50 rounded-lg space-y-2">
                  <p className="text-xs font-medium text-gray-600">Tea</p>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Qty (g)</label>
                      <NumInput value={form.tea_qty} onChange={set("tea_qty")} />
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Price/g</label>
                      <NumInput value={form.tea_price} onChange={set("tea_price")} />
                    </div>
                  </div>
                  <p className="text-xs text-right text-emerald-700 font-medium">{PKR(n(form.tea_qty) * n(form.tea_price))}</p>
                </div>
              </div>
            </div>

            {/* Spices / Extras */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Spices & Extras</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Saffron (PKR)"><NumInput value={form.saffron} onChange={set("saffron")} /></Field>
                <Field label="Cardamoms (PKR)"><NumInput value={form.cardamoms} onChange={set("cardamoms")} /></Field>
                <Field label="Pistachios (PKR)"><NumInput value={form.pistachios} onChange={set("pistachios")} /></Field>
                <Field label="Ice (PKR)"><NumInput value={form.ice} onChange={set("ice")} /></Field>
                <Field label="Essence (PKR)"><NumInput value={form.essence} onChange={set("essence")} /></Field>
                <Field label="Miscellaneous (PKR)"><NumInput value={form.miscellaneous} onChange={set("miscellaneous")} /></Field>
                <Field label="Misc. Description" className="md:col-span-2">
                  <input type="text" value={form.miscellaneous_desc} onChange={set("miscellaneous_desc")} placeholder="Description"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                </Field>
              </div>
            </div>

            {/* Services */}
            <div>
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Services & Utilities</p>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <Field label="Lights & Fans (PKR)"><NumInput value={form.lights_fans} onChange={set("lights_fans")} /></Field>
                <Field label="Gas (PKR)"><NumInput value={form.gas} onChange={set("gas")} /></Field>
                <Field label="Loud Speaker (PKR)"><NumInput value={form.loud_speaker} onChange={set("loud_speaker")} /></Field>
                <Field label="Molana Hadya (PKR)"><NumInput value={form.molana} onChange={set("molana")} /></Field>
              </div>
            </div>

            {/* Accounting breakdown + submit */}
            <div className="pt-2 border-t border-gray-100 space-y-3">
              {/* Journal preview */}
              {total > 0 && (
                <div className="bg-slate-50 rounded-lg p-3 text-xs space-y-1 font-mono">
                  <p className="text-gray-500 font-sans font-medium text-xs mb-2">Journal entries that will be created:</p>
                  <div className="flex justify-between">
                    <span className="text-gray-700">{form.debitAccount || "CASH"} DR</span>
                    <span className="font-semibold text-gray-900">{PKR(total)}</span>
                  </div>
                  {billExceptLS > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span className="pl-4">M-SUB CR</span>
                      <span>{PKR(billExceptLS)}</span>
                    </div>
                  )}
                  {loudSpeaker > 0 && (
                    <div className="flex justify-between text-gray-500">
                      <span className="pl-4">L-CHGS CR</span>
                      <span>{PKR(loudSpeaker)}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cash Received */}
              {total > 0 && (() => {
                const actualCash = form.noCash ? 0 : (form.cashReceived !== "" ? parseFloat(form.cashReceived) || 0 : total);
                const shortfall  = Math.max(0, total - actualCash);
                const status     = actualCash <= 0 ? "ADVANCE" : actualCash >= total ? "PAID" : "SHORT";
                return (
                  <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div className="flex items-center gap-3">
                      <div className="flex-1">
                        <label className="block text-xs font-medium text-gray-700 mb-1">Cash Received (PKR)</label>
                        <input
                          type="number" min="0" step="0.01"
                          value={form.noCash ? "" : form.cashReceived}
                          placeholder={form.noCash ? "0 — no cash" : String(total)}
                          disabled={form.noCash}
                          onChange={e => setForm(f => ({ ...f, cashReceived: e.target.value }))}
                          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-100 disabled:text-gray-400"
                        />
                      </div>
                      <label className="flex items-center gap-2 mt-5 cursor-pointer select-none">
                        <input type="checkbox" checked={form.noCash}
                          onChange={e => setForm(f => ({ ...f, noCash: e.target.checked, cashReceived: "" }))}
                          className="w-4 h-4 rounded accent-amber-500" />
                        <span className="text-sm text-gray-700 whitespace-nowrap">No cash received</span>
                      </label>
                    </div>
                    <div className="flex items-center gap-6 text-sm">
                      <div><span className="text-xs text-gray-500 block">Total</span><span className="font-semibold">{PKR(total)}</span></div>
                      <div><span className="text-xs text-gray-500 block">Cash Received</span><span className={cn("font-semibold", actualCash < total ? "text-amber-600" : "text-emerald-700")}>{PKR(actualCash)}</span></div>
                      <div><span className="text-xs text-gray-500 block">Balance Due</span><span className={cn("font-semibold", shortfall > 0 ? "text-red-600" : "text-gray-400")}>{shortfall > 0 ? PKR(shortfall) : "—"}</span></div>
                      <div><span className="text-xs text-gray-500 block">Status</span>
                        <span className={cn("inline-block px-2 py-0.5 rounded-full text-xs font-semibold", CASH_STATUS_STYLE[status])}>{status}</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              <div className="flex items-center justify-between">
                <div>
                  <span className="text-xs text-gray-500">Total Bill</span>
                  <p className="text-xl font-bold text-emerald-700">{PKR(total)}</p>
                </div>
                <div className="flex gap-3">
                  {editingId && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm text-gray-600 hover:bg-gray-50"
                    >
                      <X className="w-4 h-4" />
                      Cancel Edit
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={submitting}
                    className={cn(
                      "px-6 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50 transition-colors",
                      editingId ? "bg-blue-600 hover:bg-blue-700" : "bg-emerald-600 hover:bg-emerald-700"
                    )}
                  >
                    {submitting ? "Saving…" : editingId ? "Update Bill" : "Record Bill"}
                  </button>
                </div>
              </div>
            </div>
          </form>
        )}
      </div>

      {/* ── History Table ─────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-semibold text-gray-900">
            Bill History
            {!loading && <span className="ml-2 text-xs font-normal text-gray-400">({bills.length})</span>}
          </h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">#</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Hijri Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Event / Donor</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Time</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Milk</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Sugar</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Tea</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Total</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Cash Recv</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Balance</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                Array.from({ length: 3 }).map((_, i) => (
                  <tr key={i} className="animate-pulse">
                    {Array.from({ length: 12 }).map((__, j) => (
                      <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                    ))}
                  </tr>
                ))
              ) : bills.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-12 text-center text-gray-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No bills recorded yet</p>
                  </td>
                </tr>
              ) : (
                bills.map((b) => (
                  <tr key={b.id} className={cn(
                    "hover:bg-gray-50 transition-colors",
                    editingId === b.id && "bg-blue-50"
                  )}>
                    <td className="px-4 py-3 font-mono text-gray-500">{b.serial_no}</td>
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(b.date)}</td>
                    <td className="px-4 py-3 text-gray-500 text-xs whitespace-nowrap">
                      {b.hijri_day && b.hijri_month ? `${b.hijri_day} ${b.hijri_month} ${b.hijri_year ?? ""}` : "—"}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900">{b.event_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {b.from_time && b.to_time ? `${b.from_time} – ${b.to_time}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-600">{b.milk_total ? PKR(b.milk_total) : "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{b.sugar_total ? PKR(b.sugar_total) : "—"}</td>
                    <td className="px-4 py-3 text-right text-gray-600">{b.tea_total ? PKR(b.tea_total) : "—"}</td>
                    <td className="px-4 py-3 text-right font-semibold text-emerald-700">{PKR(b.total_amount)}</td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex flex-col items-end gap-0.5">
                        <span className="font-medium text-gray-700">{PKR(b.cash_received ?? b.total_amount)}</span>
                        <span className={cn("inline-block px-1.5 py-0.5 rounded-full text-xs font-semibold", CASH_STATUS_STYLE[b.cash_status || "PAID"])}>
                          {b.cash_status || "PAID"}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {(b.shortfall ?? 0) > 0
                        ? <span className="font-medium text-red-600">{PKR(b.shortfall)}</span>
                        : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <button
                          onClick={() => startEdit(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                          title="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => setDeleteTarget(b)}
                          className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
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
