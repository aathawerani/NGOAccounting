import { useState, useEffect } from "react";
import { Save, Upload, X, CheckCircle } from "lucide-react";
import { useTrust } from "../context/TrustContext";

const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

const TRUSTS = [
  { id: 1, code: "HVHT", name: "Hussaini Vakil Hussain Trust" },
  { id: 2, code: "BIB",  name: "Bait-ul-Ilm Burhani" },
  { id: 3, code: "HTTT", name: "Husami Tahir Taheri Trust" },
];

function emptyForm() {
  return {
    address: "",
    default_water_charge: "",
    fiscal_year: "",
    logo_base64: "",
  };
}

export default function TrustSettingsPage() {
  const { selectedTrust } = useTrust();
  const [activeTrust, setActiveTrust] = useState(selectedTrust?.id || 1);
  const [form, setForm] = useState(emptyForm());
  const [logoPreview, setLogoPreview] = useState("");
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    loadSettings(activeTrust);
  }, [activeTrust]);

  function loadSettings(tid) {
    setLoading(true);
    fetch(`${API}/api/trust-settings/${tid}`)
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data) {
          setForm({
            address: data.address || "",
            default_water_charge: data.default_water_charge != null ? String(data.default_water_charge) : "",
            fiscal_year: data.fiscal_year != null ? String(data.fiscal_year) : "",
            logo_base64: data.logo_base64 || "",
          });
          setLogoPreview(data.logo_base64 || "");
        } else {
          setForm(emptyForm());
          setLogoPreview("");
        }
      })
      .catch(() => {
        setForm(emptyForm());
        setLogoPreview("");
      })
      .finally(() => setLoading(false));
  }

  function handleLogoUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      const dataUri = ev.target.result;
      setForm(f => ({ ...f, logo_base64: dataUri }));
      setLogoPreview(dataUri);
    };
    reader.readAsDataURL(file);
  }

  function clearLogo() {
    setForm(f => ({ ...f, logo_base64: "" }));
    setLogoPreview("");
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        address: form.address || null,
        default_water_charge: form.default_water_charge ? parseFloat(form.default_water_charge) : null,
        fiscal_year: form.fiscal_year ? parseInt(form.fiscal_year, 10) : null,
        logo_base64: form.logo_base64 || null,
      };
      const res = await fetch(`${API}/api/trust-settings/${activeTrust}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Save failed");
      showToast("Settings saved successfully");
    } catch {
      showToast("Failed to save settings", true);
    } finally {
      setSaving(false);
    }
  }

  function showToast(msg, isError = false) {
    setToast({ msg, isError });
    setTimeout(() => setToast(null), 3000);
  }

  const activeTrustObj = TRUSTS.find(t => t.id === activeTrust);

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Trust Settings</h1>
        <p className="text-sm text-gray-500 mt-1">
          Configure display name, address, default water charge, and logo for each trust.
          These settings appear on PDF letterheads.
        </p>
      </div>

      {/* Trust selector tabs */}
      <div className="flex gap-2 border-b border-gray-200">
        {TRUSTS.map(t => (
          <button
            key={t.id}
            onClick={() => setActiveTrust(t.id)}
            className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
              activeTrust === t.id
                ? "bg-white border border-b-white border-gray-200 text-emerald-700 -mb-px z-10"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t.code}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading…</div>
      ) : (
        <form onSubmit={handleSave} className="space-y-6">
          {/* Trust identity (read-only) */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Trust Name</label>
              <p className="text-sm font-semibold text-gray-800">{activeTrustObj?.name}</p>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Short Code</label>
              <p className="text-sm font-semibold text-gray-800">{activeTrustObj?.code}</p>
            </div>
          </div>

          {/* Address */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Address <span className="text-gray-400 font-normal">(shown on PDF letterhead)</span>
            </label>
            <textarea
              value={form.address}
              onChange={e => setForm(f => ({ ...f, address: e.target.value }))}
              rows={3}
              placeholder="e.g. Plot GK6/1, Gulshan-e-Kaneez, Karachi"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Default water charge */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Default Water Charge (PKR/month)
              </label>
              <input
                type="number"
                min="0"
                step="1"
                value={form.default_water_charge}
                onChange={e => setForm(f => ({ ...f, default_water_charge: e.target.value }))}
                placeholder="e.g. 200"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>

            {/* Fiscal year */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Fiscal Year (ending year)
              </label>
              <input
                type="number"
                min="2000"
                max="2099"
                step="1"
                value={form.fiscal_year}
                onChange={e => setForm(f => ({ ...f, fiscal_year: e.target.value }))}
                placeholder={new Date().getFullYear()}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
              />
            </div>
          </div>

          {/* Logo upload */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Logo <span className="text-gray-400 font-normal">(PNG/JPEG, shown on PDF letterhead)</span>
            </label>
            <div className="flex items-start gap-4">
              {logoPreview ? (
                <div className="relative w-20 h-20 rounded-lg border border-gray-200 overflow-hidden flex-shrink-0">
                  <img
                    src={logoPreview}
                    alt="Logo preview"
                    className="w-full h-full object-contain"
                  />
                  <button
                    type="button"
                    onClick={clearLogo}
                    className="absolute top-0.5 right-0.5 bg-white rounded-full p-0.5 shadow hover:bg-red-50"
                  >
                    <X className="w-3.5 h-3.5 text-gray-500" />
                  </button>
                </div>
              ) : (
                <div className="w-20 h-20 rounded-lg border-2 border-dashed border-gray-300 flex items-center justify-center flex-shrink-0 text-gray-300">
                  <Upload className="w-6 h-6" />
                </div>
              )}
              <label className="cursor-pointer mt-1">
                <span className="inline-flex items-center gap-2 px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors">
                  <Upload className="w-4 h-4" />
                  {logoPreview ? "Change logo" : "Upload logo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleLogoUpload}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {/* Save button */}
          <div className="flex items-center gap-3 pt-2">
            <button
              type="submit"
              disabled={saving}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 transition-colors"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving…" : "Save Settings"}
            </button>
          </div>
        </form>
      )}

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 right-6 flex items-center gap-2 px-4 py-3 rounded-lg shadow-lg text-sm font-medium z-50 ${
            toast.isError ? "bg-red-600 text-white" : "bg-emerald-600 text-white"
          }`}
        >
          {!toast.isError && <CheckCircle className="w-4 h-4" />}
          {toast.msg}
        </div>
      )}
    </div>
  );
}
