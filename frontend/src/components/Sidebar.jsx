import { useState } from "react";
import {
  ChevronDown,
  ChevronRight,
  Home,
  BookOpen,
  DollarSign,
  BarChart2,
  ArrowUpDown,
  Receipt,
  LayoutDashboard,
  ShieldCheck,
} from "lucide-react";
import { cn } from "../lib/utils";

const NAV_SECTIONS = [
  {
    id: "overview",
    label: "Overview",
    icon: LayoutDashboard,
    children: [
      { id: "dashboard", label: "Dashboard" },
    ],
  },
  {
    id: "rent",
    label: "Rent",
    icon: Home,
    children: [
      { id: "rent-entry", label: "Rent Entry" },
      { id: "tenants", label: "Tenants" },
    ],
  },
  {
    id: "majlis",
    label: "Majlis",
    icon: BookOpen,
    children: [
      { id: "majlis-bills", label: "Majlis Bills" },
      { id: "vouchers", label: "Vouchers" },
    ],
  },
  {
    id: "accounts",
    label: "Accounts",
    icon: DollarSign,
    children: [
      { id: "journal-entries", label: "Journal Entries" },
      { id: "investments", label: "Investments" },
    ],
  },
  {
    id: "reports",
    label: "Reports",
    icon: BarChart2,
    children: [
      { id: "cash-position", label: "Cash Position" },
      { id: "receivables", label: "Receivables" },
      { id: "financial-reports", label: "Financial Reports" },
    ],
  },
  {
    id: "import-export",
    label: "Import / Export",
    icon: ArrowUpDown,
    children: [
      { id: "import-excel", label: "Import Excel" },
      { id: "export-reports", label: "Export Reports" },
      { id: "fiscal-year-close", label: "Fiscal Year Close" },
    ],
  },
  {
    id: "settings",
    label: "Settings",
    icon: ShieldCheck,
    children: [
      { id: "audit-log", label: "Audit Log" },
    ],
  },
];

export default function Sidebar({ activePage, onNavigate }) {
  const [expanded, setExpanded] = useState(["overview", "rent"]);

  function toggle(sectionId) {
    setExpanded((prev) =>
      prev.includes(sectionId)
        ? prev.filter((id) => id !== sectionId)
        : [...prev, sectionId]
    );
  }

  return (
    <aside className="w-64 h-full min-h-screen bg-slate-900 flex flex-col flex-shrink-0">
      {/* Brand */}
      <div className="px-5 py-5 border-b border-slate-700/60">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
            <Receipt className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="text-white font-semibold text-sm leading-tight truncate">
              NGO Accounting
            </p>
            <p className="text-slate-400 text-xs mt-0.5">Management System</p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {NAV_SECTIONS.map((section) => {
          const Icon = section.icon;
          const isExpanded = expanded.includes(section.id);
          const sectionActive = section.children.some(
            (c) => c.id === activePage
          );

          return (
            <div key={section.id}>
              <button
                onClick={() => toggle(section.id)}
                className={cn(
                  "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors duration-150",
                  sectionActive
                    ? "bg-slate-700 text-white"
                    : "text-slate-300 hover:bg-slate-800 hover:text-white"
                )}
              >
                <span className="flex items-center gap-2.5">
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {section.label}
                </span>
                {isExpanded ? (
                  <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
                ) : (
                  <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
                )}
              </button>

              {isExpanded && (
                <div className="mt-0.5 ml-4 pl-3 border-l border-slate-700/50 space-y-0.5">
                  {section.children.map((child) => (
                    <button
                      key={child.id}
                      onClick={() => onNavigate(child.id)}
                      className={cn(
                        "w-full text-left px-3 py-2 rounded-lg text-sm transition-colors duration-150",
                        activePage === child.id
                          ? "bg-emerald-600 text-white font-medium"
                          : "text-slate-400 hover:bg-slate-800 hover:text-slate-200"
                      )}
                    >
                      {child.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-slate-700/60">
        <p className="text-slate-500 text-xs text-center">v1.0.0</p>
      </div>
    </aside>
  );
}
