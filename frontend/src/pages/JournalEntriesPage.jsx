import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import { Trash2, BookOpen, AlertCircle, PlusCircle, ListOrdered } from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000";
const TODAY = new Date().toISOString().slice(0, 10);

const PKR = (n) =>
  "PKR " + Number(n ?? 0).toLocaleString("en-PK", { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const PKR_SIGNED = (n) => {
  if (!n) return <span className="text-gray-300">—</span>;
  return PKR(n);
};

function fmtDate(iso) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" });
}

function Toast({ toasts }) {
  return (
    <div className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none">
      {toasts.map((t) => (
        <div key={t.id} className={cn(
          "px-4 py-3 rounded-lg shadow-lg text-sm font-medium pointer-events-auto",
          t.type === "error" ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
        )}>
          {t.msg}
        </div>
      ))}
    </div>
  );
}

function ConfirmDialog({ accountKey, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-xl shadow-2xl p-6 w-full max-w-sm mx-4">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="w-6 h-6 text-red-500 shrink-0" />
          <h3 className="font-semibold text-gray-900">Delete Journal Entry?</h3>
        </div>
        <p className="text-sm text-gray-600 mb-6">
          Both legs of this dual entry will be permanently deleted.
        </p>
        <div className="flex justify-end gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button onClick={onConfirm} className="px-4 py-2 text-sm rounded-lg bg-red-600 text-white hover:bg-red-700">Delete Both Legs</button>
        </div>
      </div>
    </div>
  );
}

// ── Add Entry Modal ────────────────────────────────────────────────────────────
function AddEntryModal({ accounts, trustId, onSave, onClose, submitting }) {
  const [form, setForm] = useState({
    date: TODAY,
    receipt_no: "",
    party_name: "",
    debit_account_code: accounts[0]?.account_code ?? "",
    credit_account_code: accounts[1]?.account_code ?? "",
    particulars: "",
    amount: "",
  });
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
          <PlusCircle className="w-5 h-5 text-emerald-600" />
          <h3 className="font-semibold text-gray-900">New Journal Entry</h3>
        </div>
        <div className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Date *</label>
              <input type="date" value={form.date} onChange={set("date")} required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Receipt / Ref No.</label>
              <input type="text" value={form.receipt_no} onChange={set("receipt_no")} placeholder="e.g. 001"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Party Name</label>
            <input type="text" value={form.party_name} onChange={set("party_name")} placeholder="Name"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Debit Account (DR) *</label>
              <select value={form.debit_account_code} onChange={set("debit_account_code")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {accounts.map((a) => (
                  <option key={a.account_code} value={a.account_code}>
                    {a.account_code} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Credit Account (CR) *</label>
              <select value={form.credit_account_code} onChange={set("credit_account_code")}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                {accounts.map((a) => (
                  <option key={a.account_code} value={a.account_code}>
                    {a.account_code} — {a.account_name}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Particulars</label>
            <input type="text" value={form.particulars} onChange={set("particulars")} placeholder="Description"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Amount (PKR) *</label>
            <input type="number" min="0" step="0.01" value={form.amount} onChange={set("amount")} placeholder="0"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
          </div>
          {form.debit_account_code === form.credit_account_code && (
            <p className="text-xs text-amber-600">Debit and credit accounts must be different.</p>
          )}
        </div>
        <div className="flex justify-end gap-3 px-6 py-4 border-t border-gray-100">
          <button onClick={onClose} className="px-4 py-2 text-sm rounded-lg border border-gray-300 hover:bg-gray-50">Cancel</button>
          <button
            onClick={() => onSave(form)}
            disabled={submitting || !form.amount || form.debit_account_code === form.credit_account_code}
            className="px-4 py-2 text-sm rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 disabled:opacity-50"
          >
            {submitting ? "Saving…" : "Post Entry"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Transactions view (all entries, grouped as DR/CR pairs) ───────────────────
function TransactionsView({ trustId, onDelete }) {
  const [transactions, setTransactions] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState("");
  const [limit] = useState(200);

  const fetch_ = useCallback(async () => {
    if (!trustId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/accounts/transactions?trust_id=${trustId}&limit=${limit}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setTransactions(data.transactions);
      setTotal(data.total);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, [trustId, limit]);

  useEffect(() => { fetch_(); }, [fetch_]);

  const filtered = filter
    ? transactions.filter((t) =>
        [t.debit_account, t.credit_account, t.party_name, t.particulars, t.receipt_no]
          .some((v) => v && v.toLowerCase().includes(filter.toLowerCase()))
      )
    : transactions;

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-3">
        <input
          type="text"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          placeholder="Filter by account, party, particulars…"
          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
        />
        <span className="text-xs text-gray-400 whitespace-nowrap">
          {filtered.length} / {total} transactions
        </span>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Ref No.</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Party Name</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Particulars</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">DR Account</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">CR Account</th>
                <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Amount</th>
                <th className="px-4 py-3" />
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
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-6 py-12 text-center text-gray-400">
                    <ListOrdered className="w-10 h-10 mx-auto mb-3 opacity-30" />
                    <p className="font-medium">No transactions found</p>
                    {filter && <p className="text-xs mt-1">Try clearing the filter.</p>}
                  </td>
                </tr>
              ) : (
                filtered.map((t) => (
                  <tr key={t.account_key} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(t.date)}</td>
                    <td className="px-4 py-3 font-mono text-gray-500">{t.receipt_no || "—"}</td>
                    <td className="px-4 py-3 text-gray-700">{t.party_name || "—"}</td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{t.particulars || "—"}</td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded text-xs font-mono font-bold">
                        {t.debit_account}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-xs font-mono font-bold">
                        {t.credit_account}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-900">
                      {PKR(t.amount)}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => onDelete(t.account_key)}
                        className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                        title="Delete both legs"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        {total > limit && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400 text-center">
            Showing first {limit} of {total} transactions
          </div>
        )}
      </div>
    </div>
  );
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function JournalEntriesPage() {
  const { selectedTrust } = useTrust();
  const [tab, setTab] = useState("ledger"); // "ledger" | "transactions"
  const [accounts, setAccounts] = useState([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [ledger, setLedger] = useState(null);
  const [loadingAccounts, setLoadingAccounts] = useState(false);
  const [loadingLedger, setLoadingLedger] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [showModal, setShowModal] = useState(false);
  const [deleteKey, setDeleteKey] = useState(null);

  const addToast = (msg, type = "success") => {
    const id = Date.now();
    setToasts((p) => [...p, { id, msg, type }]);
    setTimeout(() => setToasts((p) => p.filter((t) => t.id !== id)), 3500);
  };

  const fetchAccounts = useCallback(async () => {
    if (!selectedTrust) return;
    setLoadingAccounts(true);
    setSelectedCode("");
    setLedger(null);
    try {
      const res = await fetch(`${API}/api/accounts/types?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setAccounts(data);
      if (data.length > 0) setSelectedCode(data[0].account_code);
    } catch {
      addToast("Failed to load accounts", "error");
    } finally {
      setLoadingAccounts(false);
    }
  }, [selectedTrust]);

  const fetchLedger = useCallback(async () => {
    if (!selectedTrust || !selectedCode) return;
    setLoadingLedger(true);
    try {
      const res = await fetch(
        `${API}/api/accounts/ledger?trust_id=${selectedTrust.id}&account_code=${encodeURIComponent(selectedCode)}`
      );
      if (!res.ok) throw new Error();
      setLedger(await res.json());
    } catch {
      addToast("Failed to load ledger", "error");
    } finally {
      setLoadingLedger(false);
    }
  }, [selectedTrust, selectedCode]);

  useEffect(() => { fetchAccounts(); }, [fetchAccounts]);
  useEffect(() => { fetchLedger(); }, [fetchLedger]);

  async function handleAddEntry(form) {
    setSubmitting(true);
    try {
      const res = await fetch(`${API}/api/accounts/journal`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          trust_id: selectedTrust.id,
          date: form.date,
          receipt_no: form.receipt_no || null,
          party_name: form.party_name || null,
          debit_account_code: form.debit_account_code,
          credit_account_code: form.credit_account_code,
          particulars: form.particulars || null,
          amount: parseFloat(form.amount),
        }),
      });
      if (!res.ok) throw new Error((await res.json()).detail ?? "Failed");
      addToast("Journal entry posted");
      setShowModal(false);
      fetchLedger();
    } catch (err) {
      addToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!deleteKey) return;
    try {
      const res = await fetch(
        `${API}/api/accounts/journal/${deleteKey}?trust_id=${selectedTrust.id}`,
        { method: "DELETE" }
      );
      if (!res.ok) throw new Error();
      addToast("Entry deleted");
      fetchLedger();
    } catch {
      addToast("Failed to delete", "error");
    } finally {
      setDeleteKey(null);
    }
  }

  const acctInfo = ledger?.account;
  const entries = ledger?.entries ?? [];
  const balance = ledger?.balance ?? 0;

  const TYPE_COLORS = {
    ASSET: "bg-blue-100 text-blue-700",
    LIABILITY: "bg-red-100 text-red-700",
    INCOME: "bg-emerald-100 text-emerald-700",
    EXPENSE: "bg-amber-100 text-amber-700",
    EQUITY: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="space-y-4">
      <Toast toasts={toasts} />
      {showModal && (
        <AddEntryModal
          accounts={accounts}
          trustId={selectedTrust?.id}
          onSave={handleAddEntry}
          onClose={() => setShowModal(false)}
          submitting={submitting}
        />
      )}
      {deleteKey && (
        <ConfirmDialog
          accountKey={deleteKey}
          onConfirm={handleDelete}
          onCancel={() => setDeleteKey(null)}
        />
      )}

      {/* ── Tab bar + action ─────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 flex flex-wrap items-center gap-4">
        <div className="flex rounded-lg border border-gray-200 overflow-hidden">
          <button
            onClick={() => setTab("ledger")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "ledger" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <BookOpen className="w-4 h-4" /> Account Ledger
          </button>
          <button
            onClick={() => setTab("transactions")}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium transition-colors",
              tab === "transactions" ? "bg-emerald-600 text-white" : "text-gray-600 hover:bg-gray-50"
            )}
          >
            <ListOrdered className="w-4 h-4" /> All Transactions
          </button>
        </div>

        {tab === "ledger" && (
          <>
            <div className="flex-1 min-w-0 sm:min-w-48">
              <select
                value={selectedCode}
                onChange={(e) => setSelectedCode(e.target.value)}
                disabled={loadingAccounts}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500 disabled:bg-gray-50"
              >
                {loadingAccounts
                  ? <option>Loading…</option>
                  : accounts.map((a) => (
                      <option key={a.account_code} value={a.account_code}>
                        {a.account_code} — {a.account_name}
                      </option>
                    ))}
              </select>
            </div>
            {acctInfo && (
              <span className={cn("px-2 py-0.5 rounded text-xs font-medium", TYPE_COLORS[acctInfo.account_type] ?? "bg-gray-100 text-gray-600")}>
                {acctInfo.account_type}
              </span>
            )}
            {acctInfo && (
              <div className="text-right">
                <p className="text-xs text-gray-500">Balance</p>
                <p className={cn("font-bold text-base", balance >= 0 ? "text-gray-900" : "text-red-600")}>
                  {PKR(Math.abs(balance))} {balance < 0 ? "CR" : "DR"}
                </p>
              </div>
            )}
          </>
        )}

        <button
          onClick={() => setShowModal(true)}
          disabled={accounts.length === 0}
          className="ml-auto flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-medium hover:bg-emerald-700 disabled:opacity-50"
        >
          <PlusCircle className="w-4 h-4" /> New Entry
        </button>
      </div>

      {/* ── Content ──────────────────────────────────────────────────────── */}
      {tab === "transactions" ? (
        <TransactionsView
          trustId={selectedTrust?.id}
          onDelete={(key) => setDeleteKey(key)}
        />
      ) : (
        /* ── Ledger table ─────────────────────────────────────────────────── */
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Date</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Ref No.</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Party Name</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600 whitespace-nowrap">Contra</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Particulars</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Debit</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Credit</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-600 whitespace-nowrap">Balance</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {loadingLedger ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      {Array.from({ length: 9 }).map((__, j) => (
                        <td key={j} className="px-4 py-3"><div className="h-4 bg-gray-200 rounded" /></td>
                      ))}
                    </tr>
                  ))
                ) : entries.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-6 py-12 text-center text-gray-400">
                      <BookOpen className="w-10 h-10 mx-auto mb-3 opacity-30" />
                      <p className="font-medium">No entries for this account</p>
                      <p className="text-xs mt-1">Click "New Entry" to post the first transaction.</p>
                    </td>
                  </tr>
                ) : (
                  entries.map((e) => (
                    <tr key={e.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-3 text-gray-700 whitespace-nowrap">{fmtDate(e.date)}</td>
                      <td className="px-4 py-3 font-mono text-gray-500">{e.receipt_no || "—"}</td>
                      <td className="px-4 py-3 text-gray-700">{e.party_name || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="px-1.5 py-0.5 bg-gray-100 rounded text-xs font-mono text-gray-600">
                          {e.contra_account_code || "—"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{e.particulars || "—"}</td>
                      <td className="px-4 py-3 text-right text-blue-700 font-medium">
                        {e.debit > 0 ? PKR(e.debit) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right text-red-600 font-medium">
                        {e.credit > 0 ? PKR(e.credit) : <span className="text-gray-300">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right font-semibold text-gray-900 whitespace-nowrap">
                        {PKR(Math.abs(e.balance))}
                        <span className="text-xs font-normal text-gray-400 ml-1">
                          {e.balance < 0 ? "CR" : "DR"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {e.account_key && (
                          <button
                            onClick={() => setDeleteKey(e.account_key)}
                            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors"
                            title="Delete both legs"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {entries.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-gray-300 bg-gray-50 font-semibold">
                    <td colSpan={5} className="px-4 py-3 text-gray-700">Closing Balance</td>
                    <td className="px-4 py-3 text-right text-blue-700">
                      {PKR(entries.reduce((s, e) => s + e.debit, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-red-600">
                      {PKR(entries.reduce((s, e) => s + e.credit, 0))}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-900">
                      {PKR(Math.abs(balance))}
                      <span className="text-xs font-normal text-gray-400 ml-1">
                        {balance < 0 ? "CR" : "DR"}
                      </span>
                    </td>
                    <td />
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
