import { Calendar, ChevronDown, Menu } from "lucide-react";
import { useTrust } from "../context/TrustContext";

const PAGE_TITLES = {
  dashboard: "Dashboard",
  "rent-entry": "Rent Entry",
  tenants: "Tenants",
  "majlis-bills": "Majlis Bills",
  vouchers: "Vouchers",
  "journal-entries": "Journal Entries",
  investments: "Investments",
  "cash-position": "Cash Position",
  receivables: "Receivables",
  "import-excel": "Import Excel",
  "export-reports": "Export Reports",
};

export default function TopBar({ activePage, onMenuToggle }) {
  const { trusts, selectedTrust, setSelectedTrust, currentDate } = useTrust();

  function handleTrustChange(e) {
    const trust = trusts.find((t) => t.id === parseInt(e.target.value));
    if (trust) setSelectedTrust(trust);
  }

  return (
    <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-4 md:px-6 flex-shrink-0 shadow-sm">
      {/* Hamburger + page title */}
      <div className="flex items-center gap-3">
        <button
          onClick={onMenuToggle}
          className="md:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <Menu className="w-5 h-5" />
        </button>
        <h1 className="text-base font-semibold text-gray-800">
          {PAGE_TITLES[activePage] ?? "Dashboard"}
        </h1>
      </div>

      {/* Right controls */}
      <div className="flex items-center gap-5">
        {/* Date display — hidden on narrow windows */}
        <div className="hidden lg:flex items-center gap-2 text-sm">
          <Calendar className="w-4 h-4 text-gray-400 flex-shrink-0" />
          <div>
            <p className="font-medium text-gray-700 leading-tight">
              {currentDate.gregorian_formatted || "—"}
            </p>
            {currentDate.hijri_formatted && (
              <p className="text-xs text-gray-400 leading-tight">
                {currentDate.hijri_formatted}
              </p>
            )}
          </div>
        </div>

        <div className="hidden lg:block h-8 w-px bg-gray-200" />

        {/* Trust selector */}
        <div className="relative flex items-center">
          <select
            value={selectedTrust?.id ?? ""}
            onChange={handleTrustChange}
            className="appearance-none bg-slate-900 text-white text-sm font-semibold pl-4 pr-9 py-2 rounded-lg cursor-pointer focus:outline-none focus:ring-2 focus:ring-emerald-500 transition-colors hover:bg-slate-800"
          >
            {trusts.map((trust) => (
              <option key={trust.id} value={trust.id}>
                {trust.code}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-white pointer-events-none" />
        </div>
      </div>
    </header>
  );
}
