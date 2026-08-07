"use client";

import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

export interface WizardStepDef {
  id: string;
  label: string;
}

/** Horizontal steps rail: current step in accent, completed steps clickable. */
export function Stepper({
  steps,
  current,
  maxReached,
  onSelect,
}: {
  steps: readonly WizardStepDef[];
  current: number;
  maxReached: number;
  onSelect: (index: number) => void;
}) {
  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2 mb-8">
      {steps.map((s, i) => {
        const done = i < current;
        const active = i === current;
        const reachable = i <= maxReached && !active;
        return (
          <div key={s.id} className="flex items-center shrink-0">
            {i > 0 ? <span className="w-5 h-px bg-line-2 mx-1.5" /> : null}
            <button
              type="button"
              disabled={!reachable}
              onClick={() => reachable && onSelect(i)}
              className={cn(
                "flex items-center gap-2 px-3 h-9 rounded-full border transition-all",
                active && "border-accent/50 bg-accent-soft text-paper",
                !active && reachable && "border-line text-paper-dim hover:text-paper hover:border-line-2 cursor-pointer",
                !active && !reachable && "border-transparent text-muted cursor-default",
              )}
            >
              <span
                className={cn(
                  "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0",
                  active ? "bg-accent text-ink" : done ? "bg-lime text-ink" : "bg-ink-3 text-paper-dim",
                )}
              >
                {done ? <Check size={11} strokeWidth={3} /> : i + 1}
              </span>
              <span className="text-[11px] font-semibold tracking-[0.1em] uppercase">{s.label}</span>
            </button>
          </div>
        );
      })}
    </div>
  );
}
