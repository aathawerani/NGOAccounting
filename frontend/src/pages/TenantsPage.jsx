import { useState, useEffect, useCallback } from "react";
import { useTrust } from "../context/TrustContext";
import {
  Plus, Search, Edit2, Trash2, X, Check, Users, ChevronDown,
  AlertTriangle, Loader2, CheckCircle2, XCircle, CreditCard,
} from "lucide-react";
import { cn } from "../lib/utils";

const API = "http://localhost:8000/api";

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

const TRUST_BADGE = {
  HVHT: "bg-emerald-100 text-emerald-700",
  BIB:  "bg-blue-100 text-blue-700",
  HTTT: "bg-violet-100 text-violet-700",
};

const EMPTY_FORM = {
  name: "",
  plot_code: "",
  space_type: "SHOP",
  space_number: "",
  monthly_rent: "",
  water_charge: "",
  cnic: "",
  is_active: true,
};

function fmtLastPaid(month, year) {
  if (!month || !year) return null;
  return `${MONTHS[month - 1]} ${year}`;
}

function fmtSpace(t) {
  const parts = [t.space_type, t.space_number].filter(Boolean).join(" ");
  if (parts && t.plot_code) return `${parts} @ ${t.plot_code}`;
  return parts || t.plot_code || "—";
}

export default function TenantsPage() {
  const { selectedTrust } = useTrust();

  const [tenants, setTenants]       = useState([]);
  const [plots, setPlots]           = useState([]);
  const [loading, setLoading]       = useState(true);
  const [fetchError, setFetchError] = useState(null);

  const [search, setSearch]             = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const [modal, setModal]           = useState(null);
  const [form, setForm]             = useState(EMPTY_FORM);
  const [formError, setFormError]   = useState(null);
  const [deleteError, setDeleteError] = useState(null);
  const [saving, setSaving]         = useState(false);
  const [deleting, setDeleting]     = useState(false);
  const [toasts, setToasts]         = useState([]);

  // ── toasts ──────────────────────────────────────────────────────────────
  function addToast(message, type = "success") {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  }
  function dismissToast(id) { setToasts(p => p.filter(t => t.id !== id)); }

  // ── data fetching ────────────────────────────────────────────────────────
  const fetchTenants = useCallback(async () => {
    if (!selectedTrust) return;
    setLoading(true); setFetchError(null);
    try {
      const res = await fetch(`${API}/tenants?trust_id=${selectedTrust.id}`);
      if (!res.ok) throw new Error("Failed to load tenants");
      setTenants(await res.json());
    } catch (e) {
      setFetchError(e.message);
    } finally {
      setLoading(false);
    }
  }, [selectedTrust]);

  const fetchPlots = useCallback(async () => {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/plots?trust_id=${selectedTrust.id}`);
      if (!res.ok) return;
      setPlots(await res.json());
    } catch { /* ignore — plots are optional */ }
  }, [selectedTrust]);

  useEffect(() => { fetchTenants(); fetchPlots(); }, [fetchTenants, fetchPlots]);

  async function backfillRates() {
    if (!selectedTrust) return;
    try {
      const res = await fetch(`${API}/tenants/backfill-rates?trust_id=${selectedTrust.id}`, { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      const data = await res.json();
      if (data.updated > 0) {
        addToast(`Updated rent rates for ${data.updated} tenant(s)`);
        fetchTenants();
      } else {
        addToast("No rates found to backfill (all tenants already set or no matching ledger entries)", "info");
      }
    } catch {
      addToast("Backfill failed", "error");
    }
  }

  // ── filtering ────────────────────────────────────────────────────────────
  const filtered = tenants.filter(t => {
    const q = search.toLowerCase();
    const matchSearch = t.name.toLowerCase().includes(q)
      || (t.space_number || "").toLowerCase().includes(q)
      || (t.plot_code || "").toLowerCase().includes(q)
      || (t.cnic || "").includes(q);
    const matchStatus = filterStatus === "all"
      || (filterStatus === "active" && t.is_active)
      || (filterStatus === "inactive" && !t.is_active);
    return matchSearch && matchStatus;
  });

  // ── modal helpers ────────────────────────────────────────────────────────
  function openAdd() {
    setForm({ ...EMPTY_FORM, plot_code: plots[0]?.code ?? "" });
    setFormError(null);
    setModal({ type: "form", mode: "add" });
  }
  function openEdit(tenant) {
    setForm({
      name:          tenant.name,
      plot_code:     tenant.plot_code || "",
      space_type:    tenant.space_type || "SHOP",
      space_number:  tenant.space_number || "",
      monthly_rent:  tenant.monthly_rent,
      water_charge:  tenant.water_charge,
      cnic:          tenant.cnic || "",
      is_active:     tenant.is_active,
    });
    setFormError(null);
    setModal({ type: "form", mode: "edit", tenant });
  }
  function openDelete(tenant) {
    setDeleteError(null);
    setModal({ type: "delete", tenant });
  }
  function closeModal() {
    setModal(null); setFormError(null); setDeleteError(null);
  }

  // ── save ─────────────────────────────────────────────────────────────────
  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name.trim()) { setFormError("Tenant name is required."); return; }
    setSaving(true); setFormError(null);
    try {
      const isEdit = modal.mode === "edit";
      const body = {
        name:          form.name.trim(),
        trust_id:      selectedTrust.id,
        plot_code:     form.plot_code || null,
        space_type:    form.space_type || null,
        space_number:  form.space_number.trim() || null,
        monthly_rent:  parseFloat(form.monthly_rent) || 0,
        water_charge:  parseFloat(form.water_charge) || 0,
        cnic:          form.cnic.trim() || null,
        last_paid_month: isEdit ? modal.tenant.last_paid_month : null,
        last_paid_year:  isEdit ? modal.tenant.last_paid_year  : null,
        is_active:     form.is_active,
      };
      const res = await fetch(
        isEdit ? `${API}/tenants/${modal.tenant.id}` : `${API}/tenants`,
        { method: isEdit ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || "Failed to save tenant.");
      }
      const saved = await res.json();
      setTenants(p => isEdit ? p.map(t => t.id === saved.id ? saved : t) : [...p, saved]);
      closeModal();
      addToast(isEdit ? "Tenant updated." : "Tenant added.");
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  }

  // ── delete ────────────────────────────────────────────────────────────────
  async function handleDelete() {
    setDeleting(true); setDeleteError(null);
    try {
      const res = await fetch(`${API}/tenants/${modal.tenant.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete tenant.");
      const name = modal.tenant.name;
      setTenants(p => p.filter(t => t.id !== modal.tenant.id));
      closeModal();
      addToast(`${name} deleted.`, "info");
    } catch (e) {
      setDeleteError(e.message);
    } finally {
      setDeleting(false);
    }
  }

  const total    = tenants.length;
  const active   = tenants.filter(t => t.is_active).length;
  const inactive = total - active;
  const hasFilters = search || filterStatus !== "all";

  return (
    <div className="space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Tenants" value={total}    valueClass="text-slate-700" />
        <StatCard label="Active"        value={active}   valueClass="text-emerald-600" />
        <StatCard label="Inactive"      value={inactive} valueClass="text-gray-400" />
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Toolbar */}
        <div className="px-4 py-3 border-b border-gray-100 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-0 sm:min-w-52">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            <input
              type="text"
              placeholder="Search name, space, CNIC…"
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400"
            />
          </div>

          <div className="flex rounded-lg border border-gray-200 overflow-hidden text-sm">
            {["all","active","inactive"].map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                className={cn("px-3 py-1.5 capitalize transition-colors",
                  filterStatus === s ? "bg-slate-900 text-white font-medium" : "bg-white text-gray-500 hover:bg-gray-50")}>
                {s}
              </button>
            ))}
          </div>

          <button onClick={backfillRates} title="Parse rent/water rates from imported ledger entries"
            className="flex items-center gap-2 border border-gray-200 bg-white hover:bg-gray-50 text-gray-600 text-sm font-medium px-3 py-2 rounded-lg transition-colors">
            Fix Rates
          </button>
          <button onClick={openAdd}
            className="ml-auto flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors">
            <Plus className="w-4 h-4" /> Add Tenant
          </button>
        </div>

        {/* Body */}
        {loading ? <LoadingSkeleton /> :
         fetchError ? <ErrorState message={fetchError} onRetry={fetchTenants} /> :
         filtered.length === 0 ? <EmptyState hasFilters={hasFilters} onAdd={openAdd} /> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50/80 border-b border-gray-100">
                  {["Tenant","Space","Monthly Rent","Water Charge","Last Paid","Status",""].map((h,i) => (
                    <th key={i} className={cn(
                      "px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap",
                      i >= 2 && i <= 3 ? "text-right" : i === 4 ? "text-center" : i === 5 ? "text-center" : "text-left",
                      i === 6 ? "w-20" : ""
                    )}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(tenant => (
                  <TenantRow key={tenant.id} tenant={tenant}
                    onEdit={() => openEdit(tenant)}
                    onDelete={() => openDelete(tenant)} />
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !fetchError && filtered.length > 0 && (
          <div className="px-4 py-2.5 border-t border-gray-100 text-xs text-gray-400">
            Showing {filtered.length} of {total} tenant{total !== 1 ? "s" : ""}
          </div>
        )}
      </div>

      {/* Modal */}
      {modal && (
        <ModalOverlay onClose={closeModal}>
          {modal.type === "form" ? (
            <TenantFormModal
              mode={modal.mode} form={form} setForm={setForm}
              plots={plots} selectedTrust={selectedTrust}
              tenant={modal.tenant}
              error={formError} saving={saving}
              onSubmit={handleSubmit} onClose={closeModal} />
          ) : (
            <DeleteModal tenant={modal.tenant} error={deleteError}
              deleting={deleting} onConfirm={handleDelete} onClose={closeModal} />
          )}
        </ModalOverlay>
      )}

      <ToastContainer toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}

/* ─── Sub-components ──────────────────────────────────────────────────────── */

function StatCard({ label, value, valueClass }) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm px-5 py-4">
      <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">{label}</p>
      <p className={cn("text-3xl font-bold mt-1", valueClass)}>{value}</p>
    </div>
  );
}

function TenantRow({ tenant, onEdit, onDelete }) {
  const lastPaid = fmtLastPaid(tenant.last_paid_month, tenant.last_paid_year);
  return (
    <tr className="hover:bg-gray-50/60 transition-colors group">
      {/* Name */}
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
            <Users className="w-4 h-4 text-slate-400" />
          </div>
          <div className="min-w-0">
            <p className="font-medium text-gray-800 truncate">{tenant.name}</p>
            {tenant.cnic && <p className="text-xs text-gray-400 truncate">{tenant.cnic}</p>}
          </div>
        </div>
      </td>

      {/* Space */}
      <td className="px-4 py-3 text-gray-600">
        <span className="text-sm">{fmtSpace(tenant)}</span>
      </td>

      {/* Monthly Rent */}
      <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
        {tenant.monthly_rent > 0 ? (<><span className="text-gray-400 text-xs mr-1">PKR</span>{tenant.monthly_rent.toLocaleString()}</>) : <span className="text-gray-300">—</span>}
      </td>

      {/* Water Charge */}
      <td className="px-4 py-3 text-right font-mono text-gray-700 whitespace-nowrap">
        {tenant.water_charge > 0 ? (<><span className="text-gray-400 text-xs mr-1">PKR</span>{tenant.water_charge.toLocaleString()}</>) : <span className="text-gray-300">—</span>}
      </td>

      {/* Last Paid */}
      <td className="px-4 py-3 text-center">
        {lastPaid ? (
          <span className="text-sm text-gray-600 font-medium">{lastPaid}</span>
        ) : (
          <span className="text-gray-300 text-sm">—</span>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-3 text-center">
        <span className={cn("inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-medium",
          tenant.is_active ? "bg-emerald-50 text-emerald-700" : "bg-gray-100 text-gray-500")}>
          {tenant.is_active && <Check className="w-3 h-3" />}
          {tenant.is_active ? "Active" : "Inactive"}
        </span>
      </td>

      {/* Actions */}
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={onEdit} title="Edit"
            className="p-1.5 rounded-md hover:bg-blue-50 text-gray-400 hover:text-blue-600 transition-colors">
            <Edit2 className="w-3.5 h-3.5" />
          </button>
          <button onClick={onDelete} title="Delete"
            className="p-1.5 rounded-md hover:bg-red-50 text-gray-400 hover:text-red-600 transition-colors">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </td>
    </tr>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative w-full max-w-xl">{children}</div>
    </div>
  );
}

function TenantFormModal({ mode, form, setForm, plots, selectedTrust, tenant, error, saving, onSubmit, onClose }) {
  function set(k, v) { setForm(p => ({ ...p, [k]: v })); }
  const trustBadge = TRUST_BADGE[selectedTrust?.code] ?? "bg-gray-100 text-gray-600";
  const lastPaid = tenant ? fmtLastPaid(tenant.last_paid_month, tenant.last_paid_year) : null;

  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 sticky top-0 bg-white z-10">
        <div className="flex items-center gap-3">
          <h2 className="text-base font-semibold text-gray-900">
            {mode === "add" ? "Add New Tenant" : "Edit Tenant"}
          </h2>
          {selectedTrust && (
            <span className={cn("text-xs font-semibold px-2 py-0.5 rounded-full", trustBadge)}>
              {selectedTrust.code}
            </span>
          )}
        </div>
        <button onClick={onClose}
          className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors">
          <X className="w-4 h-4" />
        </button>
      </div>

      <form onSubmit={onSubmit} className="p-6 space-y-4">
        {error && (
          <div className="flex items-start gap-2 text-sm text-red-600 bg-red-50 border border-red-100 px-3 py-2.5 rounded-lg">
            <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />{error}
          </div>
        )}

        {/* Last paid info (edit mode) */}
        {mode === "edit" && (
          <div className="text-xs text-gray-500 bg-gray-50 border border-gray-100 rounded-lg px-3 py-2">
            Last paid rent: <strong className="text-gray-700">{lastPaid ?? "—"}</strong>
            <span className="text-gray-400 ml-2">(updated automatically by rent receipts)</span>
          </div>
        )}

        {/* Name */}
        <div>
          <label className="block text-xs font-semibold text-gray-600 mb-1.5">
            Tenant Name <span className="text-red-400">*</span>
          </label>
          <input type="text" value={form.name} onChange={e => set("name", e.target.value)}
            placeholder="Full name" autoFocus
            className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400" />
        </div>

        {/* Plot + Space Type */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Plot / Property</label>
            <div className="relative">
              <select value={form.plot_code} onChange={e => set("plot_code", e.target.value)}
                className="w-full appearance-none px-3 py-2.5 pr-8 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer">
                <option value="">None</option>
                {plots.map(p => <option key={p.id} value={p.code}>{p.code}</option>)}
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
            </div>
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Space Type</label>
            <div className="flex rounded-lg border border-gray-200 overflow-hidden">
              {["SHOP","FLAT"].map(s => (
                <button key={s} type="button" onClick={() => set("space_type", s)}
                  className={cn("flex-1 py-2.5 text-sm font-medium transition-colors",
                    form.space_type === s ? "bg-slate-900 text-white" : "bg-white text-gray-500 hover:bg-gray-50")}>
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Space Number + CNIC */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Space Number</label>
            <input type="text" value={form.space_number} onChange={e => set("space_number", e.target.value)}
              placeholder="e.g. 34"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">CNIC</label>
            <input type="text" value={form.cnic} onChange={e => set("cnic", e.target.value)}
              placeholder="XXXXX-XXXXXXX-X"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400" />
          </div>
        </div>

        {/* Monthly Rent + Water Charge */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Monthly Rent (PKR)</label>
            <input type="number" min="0" step="1" value={form.monthly_rent} onChange={e => set("monthly_rent", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400" />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-600 mb-1.5">Water Charge (PKR)</label>
            <input type="number" min="0" step="1" value={form.water_charge} onChange={e => set("water_charge", e.target.value)}
              placeholder="0"
              className="w-full px-3 py-2.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent placeholder:text-gray-400" />
          </div>
        </div>

        {/* Active toggle */}
        <div className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-4 py-3">
          <div>
            <p className="text-sm font-medium text-gray-700">Active</p>
            <p className="text-xs text-gray-400 mt-0.5">Inactive tenants are excluded from rent runs</p>
          </div>
          <button type="button" onClick={() => set("is_active", !form.is_active)}
            className={cn("relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2",
              form.is_active ? "bg-emerald-500" : "bg-gray-300")}>
            <span className={cn("inline-block h-4 w-4 transform rounded-full bg-white shadow-sm transition-transform duration-200",
              form.is_active ? "translate-x-6" : "translate-x-1")} />
          </button>
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={saving}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {mode === "add" ? "Add Tenant" : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
}

function DeleteModal({ tenant, error, deleting, onConfirm, onClose }) {
  return (
    <div className="bg-white rounded-2xl shadow-2xl border border-gray-100 p-6">
      <div className="flex items-start gap-4 mb-4">
        <div className="w-11 h-11 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0">
          <Trash2 className="w-5 h-5 text-red-600" />
        </div>
        <div>
          <h2 className="text-base font-semibold text-gray-900">Delete Tenant</h2>
          <p className="text-sm text-gray-500 mt-0.5">This action cannot be undone.</p>
        </div>
      </div>
      <p className="text-sm text-gray-700 bg-gray-50 border border-gray-100 rounded-lg px-4 py-3 mb-4">
        Delete <strong className="text-gray-900">{tenant.name}</strong>? Rent receipts linked to this tenant will lose their reference.
      </p>
      {error && (
        <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg mb-4">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />{error}
        </div>
      )}
      <div className="flex gap-3">
        <button onClick={onClose}
          className="flex-1 px-4 py-2.5 text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors">
          Cancel
        </button>
        <button onClick={onConfirm} disabled={deleting}
          className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors disabled:opacity-60 disabled:cursor-not-allowed">
          {deleting && <Loader2 className="w-4 h-4 animate-spin" />}
          Delete Tenant
        </button>
      </div>
    </div>
  );
}

function ToastContainer({ toasts, onDismiss }) {
  if (!toasts.length) return null;
  return (
    <div className="fixed top-5 right-5 z-[60] flex flex-col gap-2 pointer-events-none">
      {toasts.map(toast => (
        <div key={toast.id} className={cn(
          "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border text-sm font-medium pointer-events-auto max-w-sm bg-white",
          toast.type === "success" ? "border-emerald-100" : toast.type === "error" ? "border-red-100" : "border-gray-100")}>
          {toast.type === "success" ? <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0" />
           : toast.type === "error" ? <XCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
           : <CheckCircle2 className="w-4 h-4 text-gray-400 flex-shrink-0" />}
          <span className="flex-1 text-gray-800">{toast.message}</span>
          <button onClick={() => onDismiss(toast.id)} className="text-gray-300 hover:text-gray-500 transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="p-4 space-y-2.5">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-12 rounded-lg bg-gray-100 animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
      ))}
    </div>
  );
}

function ErrorState({ message, onRetry }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-12 h-12 rounded-full bg-red-50 flex items-center justify-center mb-3">
        <AlertTriangle className="w-6 h-6 text-red-400" />
      </div>
      <p className="text-sm font-medium text-gray-700">{message}</p>
      <button onClick={onRetry} className="mt-3 text-xs font-medium text-emerald-600 hover:text-emerald-700 hover:underline">
        Try again
      </button>
    </div>
  );
}

function EmptyState({ hasFilters, onAdd }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
        <Users className="w-7 h-7 text-gray-300" />
      </div>
      <p className="text-sm font-semibold text-gray-600">
        {hasFilters ? "No tenants match your filters" : "No tenants yet"}
      </p>
      <p className="text-xs text-gray-400 mt-1">
        {hasFilters ? "Try adjusting your search or filter criteria" : "Add your first tenant to get started"}
      </p>
      {!hasFilters && (
        <button onClick={onAdd}
          className="mt-4 flex items-center gap-1.5 text-sm font-medium text-emerald-600 hover:text-emerald-700 transition-colors">
          <Plus className="w-4 h-4" /> Add Tenant
        </button>
      )}
    </div>
  );
}
