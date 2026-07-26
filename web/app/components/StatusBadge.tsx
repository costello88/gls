import type { OrderRecordStatus } from "../../lib/dashboard/types";

const STYLES: Record<OrderRecordStatus, { label: string; className: string }> = {
  PENDING: { label: "In behandeling", className: "bg-slate-100 text-slate-700" },
  NEEDS_REVIEW: { label: "Controleren", className: "bg-amber-100 text-amber-800" },
  READY: { label: "Klaar", className: "bg-blue-100 text-blue-800" },
  PRINTED: { label: "Geprint", className: "bg-green-100 text-green-800" },
  ERROR: { label: "Fout", className: "bg-red-100 text-red-800" },
  IGNORED: { label: "Genegeerd", className: "bg-slate-100 text-slate-400" },
};

export function StatusBadge({ status }: { status: OrderRecordStatus }) {
  const { label, className } = STYLES[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${className}`}>
      {label}
    </span>
  );
}
