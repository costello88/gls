import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

/* ---------------------------------------------------------------- Button */

type ButtonVariant = "primary" | "accent" | "ghost" | "danger" | "outline";

const BUTTON_STYLES: Record<ButtonVariant, string> = {
  primary: "bg-paper text-ink hover:bg-white",
  accent: "bg-accent text-ink hover:brightness-110",
  ghost: "bg-transparent text-paper-dim hover:text-paper hover:bg-ink-3",
  danger: "bg-transparent text-danger border border-danger/30 hover:bg-danger/10",
  outline: "bg-transparent text-paper border border-line-2 hover:border-paper/40",
};

export function Button({
  variant = "primary",
  size = "md",
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 ease-out rounded-lg disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer whitespace-nowrap",
        size === "sm" && "text-xs px-3 h-8",
        size === "md" && "text-sm px-4 h-10",
        size === "lg" && "text-sm px-6 h-12",
        BUTTON_STYLES[variant],
        className,
      )}
      {...props}
    />
  );
}

/* ---------------------------------------------------------------- Card */

export function Card({
  className,
  hover = false,
  children,
}: {
  className?: string;
  hover?: boolean;
  children: ReactNode;
}) {
  return <div className={cn("card", hover && "card-hover", className)}>{children}</div>;
}

/* ---------------------------------------------------------------- Badge */

const BADGE_TONES = {
  neutral: "bg-ink-3 text-paper-dim",
  accent: "bg-accent-soft text-accent",
  lime: "bg-lime-soft text-lime",
  danger: "bg-danger/10 text-danger",
  warn: "bg-warn/10 text-warn",
  paper: "bg-paper text-ink",
} as const;

export type BadgeTone = keyof typeof BADGE_TONES;

export function Badge({
  tone = "neutral",
  className,
  children,
}: {
  tone?: BadgeTone;
  className?: string;
  children: ReactNode;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold tracking-wide",
        BADGE_TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

/** Maps post/account/giveaway statuses to badge tones. */
export function statusTone(status: string): BadgeTone {
  switch (status) {
    case "published":
    case "active":
    case "live":
    case "followed_back":
    case "done":
      return "lime";
    case "scheduled":
    case "planned":
    case "materialized":
    case "running":
    case "queued":
      return "accent";
    case "publishing":
    case "token_expiring":
    case "drawn":
    case "followed":
      return "warn";
    case "failed":
    case "token_expired":
    case "error":
      return "danger";
    default:
      return "neutral";
  }
}

/* ---------------------------------------------------------------- PageHeader */

export function PageHeader({
  overline,
  title,
  description,
  actions,
}: {
  overline?: string;
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
      <div className="animate-rise">
        {overline ? <div className="microlabel mb-2">{overline}</div> : null}
        <h1 className="display text-4xl text-paper">{title}</h1>
        {description ? <p className="text-sm text-paper-dim mt-2 max-w-xl">{description}</p> : null}
      </div>
      {actions ? <div className="flex items-center gap-2">{actions}</div> : null}
    </div>
  );
}

/* ---------------------------------------------------------------- StatCard */

export function StatCard({
  label,
  value,
  hint,
  accent = false,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  accent?: boolean;
}) {
  return (
    <Card className="p-5">
      <div className="microlabel">{label}</div>
      <div className={cn("stat-number text-4xl mt-2", accent ? "text-accent" : "text-paper")}>{value}</div>
      {hint ? <div className="text-xs text-muted mt-1.5">{hint}</div> : null}
    </Card>
  );
}

/* ---------------------------------------------------------------- EmptyState */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon?: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <Card className="grain relative overflow-hidden">
      <div className="flex flex-col items-center justify-center text-center px-8 py-16">
        {icon ? <div className="text-muted mb-4 [&>svg]:w-8 [&>svg]:h-8">{icon}</div> : null}
        <div className="display text-xl text-paper">{title}</div>
        {description ? <p className="text-sm text-paper-dim mt-2 max-w-sm">{description}</p> : null}
        {action ? <div className="mt-6">{action}</div> : null}
      </div>
    </Card>
  );
}

/* ---------------------------------------------------------------- Spinner */

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block w-4 h-4 rounded-full border-2 border-paper-dim/30 border-t-paper animate-spin",
        className,
      )}
    />
  );
}

/* ---------------------------------------------------------------- Field wrappers */

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="microlabel">{label}</span>
      {children}
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </label>
  );
}

const INPUT_CLASS =
  "bg-ink-3 border border-line rounded-lg px-3.5 h-10 text-sm text-paper placeholder:text-muted outline-none focus:border-accent/60 transition-colors w-full";

export function Input({ className, ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(INPUT_CLASS, className)} {...props} />;
}

export function Textarea({ className, ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(INPUT_CLASS, "py-2.5 h-auto min-h-24 leading-relaxed", className)} {...props} />;
}

export function Select({ className, children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className={cn(INPUT_CLASS, "appearance-none cursor-pointer", className)} {...props}>
      {children}
    </select>
  );
}
