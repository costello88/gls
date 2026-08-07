"use client";

import { useEffect, useState } from "react";
import { Check, ExternalLink, PartyPopper, ShieldAlert, SkipForward } from "lucide-react";
import { Button, Input, Spinner } from "@/components/ui/primitives";
import { Modal } from "@/components/ui/interactive";
import { formatCompact } from "@/lib/utils";
import type { OutreachTarget } from "@/lib/types";

/**
 * Session mode: serves the queue one target at a time.
 * The user opens the profile on Instagram, taps Follow there, then marks the
 * result here — Postcraft never acts on the account itself.
 */
export function SessionModal({
  open,
  onClose,
  queue,
  todayFollowed,
  dailyTarget,
  busy,
  onAction,
}: {
  open: boolean;
  onClose: () => void;
  /** Targets still in "queued" status, first item is served next. */
  queue: OutreachTarget[];
  todayFollowed: number;
  dailyTarget: number;
  busy: boolean;
  onAction: (target: OutreachTarget, status: "followed" | "skipped", notes: string) => Promise<void>;
}) {
  const current: OutreachTarget | null = queue[0] ?? null;
  const currentId = current?.id ?? null;
  const [notes, setNotes] = useState("");

  // Reset the notes draft whenever a new target is served.
  useEffect(() => {
    setNotes(current?.notes ?? "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentId]);

  const profileUrl = current ? `https://instagram.com/${current.username}` : null;
  const targetHit = dailyTarget > 0 && todayFollowed >= dailyTarget;
  const progressPct = dailyTarget > 0 ? Math.min(100, (todayFollowed / dailyTarget) * 100) : 0;

  // Keyboard shortcuts: F = followed, S = skip, O = open profile.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const el = e.target as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) return;
      if (!current) return;
      const key = e.key.toLowerCase();
      if (key === "f") {
        e.preventDefault();
        if (!busy) void onAction(current, "followed", notes);
      } else if (key === "s") {
        e.preventDefault();
        if (!busy) void onAction(current, "skipped", notes);
      } else if (key === "o" && profileUrl) {
        e.preventDefault();
        window.open(profileUrl, "_blank", "noopener,noreferrer");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, current, busy, notes, profileUrl, onAction]);

  return (
    <Modal open={open} onClose={onClose} title="Today&apos;s session" wide>
      {/* Progress strip */}
      <div className="flex items-center gap-4 mb-5">
        <div className="microlabel shrink-0">
          {todayFollowed} of {dailyTarget} today
        </div>
        <div className="flex-1 h-1.5 rounded-full bg-ink-3 overflow-hidden">
          <div
            className="h-full bg-accent transition-all duration-150 ease-out"
            style={{ width: `${progressPct}%` }}
          />
        </div>
        <div className="text-[11px] text-muted shrink-0 hidden sm:block">F followed · S skip · O open</div>
      </div>

      {targetHit ? (
        <div className="flex items-center gap-4 rounded-card border border-warn/40 bg-warn/10 px-5 py-4 mb-5 animate-rise">
          <ShieldAlert size={18} className="text-warn shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold text-paper">
              Target hit — stop here to keep the account safe
            </div>
            <div className="text-xs text-paper-dim mt-0.5">
              You&apos;ve marked {todayFollowed} follows today. Pacing is the protection — you can keep
              going, but slower is safer.
            </div>
          </div>
          <Button size="sm" variant="outline" className="shrink-0" onClick={onClose}>
            Stop for today
          </Button>
        </div>
      ) : null}

      {!current ? (
        <div className="text-center py-14">
          <PartyPopper size={28} className="mx-auto text-muted mb-4" />
          <div className="display text-xl text-paper">Queue cleared</div>
          <p className="text-sm text-paper-dim mt-2 max-w-sm mx-auto">
            Every queued target has been worked. Paste more links or handles into the import box to
            keep the pipeline moving.
          </p>
          <Button variant="outline" className="mt-6" onClick={onClose}>
            Close session
          </Button>
        </div>
      ) : (
        <div className="text-center py-4">
          <a
            href={profileUrl ?? "#"}
            target="_blank"
            rel="noreferrer"
            className="display text-4xl text-paper hover:text-accent transition-colors break-all"
          >
            @{current.username}
          </a>
          {current.full_name ? (
            <div className="text-sm text-paper-dim mt-1.5">{current.full_name}</div>
          ) : null}

          {current.followers_count !== null || current.media_count !== null ? (
            <div className="flex items-center justify-center gap-8 mt-5">
              {current.followers_count !== null ? (
                <div>
                  <div className="stat-number text-2xl text-paper">
                    {formatCompact(current.followers_count)}
                  </div>
                  <div className="microlabel mt-0.5">Followers</div>
                </div>
              ) : null}
              {current.media_count !== null ? (
                <div>
                  <div className="stat-number text-2xl text-paper">
                    {formatCompact(current.media_count)}
                  </div>
                  <div className="microlabel mt-0.5">Posts</div>
                </div>
              ) : null}
            </div>
          ) : (
            <div className="text-xs text-muted mt-4">Not enriched — no follower data yet</div>
          )}

          {current.biography ? (
            <p className="text-sm text-paper-dim max-w-md mx-auto mt-4 leading-relaxed line-clamp-3">
              {current.biography}
            </p>
          ) : null}

          <div className="max-w-sm mx-auto mt-6">
            <Input
              placeholder="Notes — saved with your decision"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 mt-7">
            <a href={profileUrl ?? "#"} target="_blank" rel="noreferrer">
              <Button variant="accent">
                <ExternalLink size={15} />
                Open profile
              </Button>
            </a>
            <Button variant="primary" disabled={busy} onClick={() => void onAction(current, "followed", notes)}>
              {busy ? <Spinner className="w-3.5 h-3.5" /> : <Check size={15} />}
              Followed
            </Button>
            <Button variant="outline" disabled={busy} onClick={() => void onAction(current, "skipped", notes)}>
              <SkipForward size={15} />
              Skip
            </Button>
          </div>

          <div className="text-xs text-muted mt-5">
            {queue.length} left in queue · tap Follow inside Instagram, then mark it here
          </div>
        </div>
      )}
    </Modal>
  );
}
