/**
 * Shared UI primitives used across all pages.
 * Import from "@/components/ui" or with relative path.
 */

import { cn } from "../lib/utils";

// ── Skeleton ──────────────────────────────────────────────────────────────────

export function Skeleton({ className }) {
  return <div className={cn("animate-pulse bg-gray-200 rounded", className)} />;
}

export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <tbody>
      {Array.from({ length: rows }).map((_, r) => (
        <tr key={r} className="border-b border-gray-100">
          {Array.from({ length: cols }).map((_, c) => (
            <td key={c} className="px-4 py-3">
              <Skeleton className="h-4 w-full" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}

export function SkeletonCard({ className }) {
  return (
    <div className={cn("bg-white rounded-xl border border-gray-200 shadow-sm p-5", className)}>
      <Skeleton className="w-10 h-10 rounded-lg mb-3" />
      <Skeleton className="h-3 w-20 mb-2" />
      <Skeleton className="h-7 w-28" />
    </div>
  );
}

// ── EmptyState ────────────────────────────────────────────────────────────────

export function EmptyState({ icon: Icon, title, description, action }) {
  return (
    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
      {Icon && (
        <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-4">
          <Icon className="w-7 h-7 text-gray-400" />
        </div>
      )}
      <p className="text-base font-semibold text-gray-700 mb-1">{title}</p>
      {description && <p className="text-sm text-gray-400 max-w-xs">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

// ── StatCard ──────────────────────────────────────────────────────────────────

export function StatCard({ label, value, sub, color = "gray", icon: Icon, onClick }) {
  const colors = {
    emerald: { bg: "bg-emerald-50 border-emerald-200", icon: "bg-emerald-100 text-emerald-600", value: "text-emerald-700" },
    blue:    { bg: "bg-blue-50 border-blue-200",       icon: "bg-blue-100 text-blue-600",       value: "text-blue-700"    },
    amber:   { bg: "bg-amber-50 border-amber-200",     icon: "bg-amber-100 text-amber-600",     value: "text-amber-700"   },
    red:     { bg: "bg-red-50 border-red-200",         icon: "bg-red-100 text-red-600",         value: "text-red-700"     },
    violet:  { bg: "bg-violet-50 border-violet-200",   icon: "bg-violet-100 text-violet-600",   value: "text-violet-700"  },
    gray:    { bg: "bg-white border-gray-200",         icon: "bg-gray-100 text-gray-500",       value: "text-gray-800"    },
  };
  const c = colors[color] ?? colors.gray;
  const Tag = onClick ? "button" : "div";
  return (
    <Tag
      onClick={onClick}
      className={cn(
        "rounded-xl border shadow-sm p-4 text-left transition-all",
        c.bg,
        onClick && "hover:shadow-md hover:-translate-y-0.5 cursor-pointer"
      )}
    >
      {Icon && (
        <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center mb-3", c.icon)}>
          <Icon className="w-4 h-4" />
        </div>
      )}
      <p className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-0.5">{label}</p>
      <p className={cn("text-xl font-bold leading-tight", c.value)}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-0.5">{sub}</p>}
    </Tag>
  );
}

// ── PageHeader ────────────────────────────────────────────────────────────────

export function PageHeader({ title, description, breadcrumb, actions }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6">
      <div>
        {breadcrumb && (
          <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-1">
            {breadcrumb}
          </p>
        )}
        <h1 className="text-2xl font-bold text-gray-900">{title}</h1>
        {description && <p className="text-sm text-gray-500 mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2 shrink-0">{actions}</div>}
    </div>
  );
}

// ── Badge ─────────────────────────────────────────────────────────────────────

export function Badge({ children, color = "gray" }) {
  const colors = {
    green:  "bg-emerald-100 text-emerald-700",
    red:    "bg-red-100 text-red-700",
    amber:  "bg-amber-100 text-amber-700",
    blue:   "bg-blue-100 text-blue-700",
    violet: "bg-violet-100 text-violet-700",
    gray:   "bg-gray-100 text-gray-600",
  };
  return (
    <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium", colors[color] ?? colors.gray)}>
      {children}
    </span>
  );
}

// ── Button ────────────────────────────────────────────────────────────────────

export function Btn({ children, variant = "primary", size = "md", className, disabled, onClick, type = "button" }) {
  const variants = {
    primary:   "bg-slate-800 hover:bg-slate-900 text-white",
    danger:    "bg-red-600 hover:bg-red-700 text-white",
    success:   "bg-emerald-600 hover:bg-emerald-700 text-white",
    secondary: "bg-white hover:bg-gray-50 text-gray-700 border border-gray-300",
    ghost:     "bg-transparent hover:bg-gray-100 text-gray-600",
  };
  const sizes = {
    sm:  "px-2.5 py-1.5 text-xs",
    md:  "px-4 py-2 text-sm",
    lg:  "px-5 py-2.5 text-sm",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "inline-flex items-center justify-center gap-1.5 font-medium rounded-lg transition-colors focus:outline-none focus:ring-2 focus:ring-offset-1 focus:ring-slate-400 disabled:opacity-50 disabled:pointer-events-none",
        variants[variant] ?? variants.primary,
        sizes[size] ?? sizes.md,
        className
      )}
    >
      {children}
    </button>
  );
}
