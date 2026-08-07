"use client";

import { cn } from "@/lib/utils";
import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

/* ---------------------------------------------------------------- Tabs */

export function Tabs<T extends string>({
  value,
  onChange,
  options,
  className,
}: {
  value: T;
  onChange: (v: T) => void;
  options: Array<{ value: T; label: string }>;
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-1 bg-ink-3 rounded-lg p-1 w-fit", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          onClick={() => onChange(o.value)}
          className={cn(
            "px-3.5 h-8 rounded-md text-xs font-semibold transition-colors cursor-pointer",
            o.value === value ? "bg-paper text-ink" : "text-paper-dim hover:text-paper",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Segmented multi-select */

export function SegmentedMulti<T extends string>({
  values,
  onChange,
  options,
  className,
}: {
  values: T[];
  onChange: (v: T[]) => void;
  options: Array<{ value: T; label: string; disabled?: boolean }>;
  className?: string;
}) {
  const toggle = (v: T) =>
    onChange(values.includes(v) ? values.filter((x) => x !== v) : [...values, v]);
  return (
    <div className={cn("flex flex-wrap items-center gap-2", className)}>
      {options.map((o) => (
        <button
          key={o.value}
          disabled={o.disabled}
          onClick={() => toggle(o.value)}
          className={cn(
            "px-4 h-9 rounded-full text-xs font-semibold border transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed",
            values.includes(o.value)
              ? "bg-accent text-ink border-accent"
              : "bg-transparent text-paper-dim border-line-2 hover:border-paper/40 hover:text-paper",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/* ---------------------------------------------------------------- Modal */

export function Modal({
  open,
  onClose,
  title,
  children,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  wide?: boolean;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={onClose} />
      <div
        className={cn(
          "relative card bg-ink-2 w-full max-h-[85vh] overflow-y-auto animate-rise",
          wide ? "max-w-3xl" : "max-w-lg",
        )}
      >
        <div className="flex items-center justify-between px-6 pt-5 pb-1">
          {title ? <h2 className="display text-xl text-paper">{title}</h2> : <span />}
          <button
            onClick={onClose}
            className="text-muted hover:text-paper transition-colors cursor-pointer"
            aria-label="Close"
          >
            <X size={18} />
          </button>
        </div>
        <div className="px-6 pb-6 pt-3">{children}</div>
      </div>
    </div>
  );
}

/* ---------------------------------------------------------------- Toggle */

export function Toggle({
  checked,
  onChange,
  label,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center gap-2.5 cursor-pointer group"
    >
      <span
        className={cn(
          "w-9 h-5 rounded-full p-0.5 transition-colors flex",
          checked ? "bg-accent justify-end" : "bg-ink-3 border border-line justify-start",
        )}
      >
        <span className="w-4 h-4 rounded-full bg-paper block" />
      </span>
      {label ? (
        <span className="text-sm text-paper-dim group-hover:text-paper transition-colors">{label}</span>
      ) : null}
    </button>
  );
}
