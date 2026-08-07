"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { format } from "date-fns";
import {
  AlertTriangle,
  CheckCheck,
  ClipboardPaste,
  Play,
  RefreshCw,
  Save,
  SkipForward,
  Sparkles,
  StickyNote,
  UserPlus,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  StatCard,
  Textarea,
  statusTone,
} from "@/components/ui/primitives";
import { Modal, Tabs } from "@/components/ui/interactive";
import { SessionModal } from "@/components/outreach/session-modal";
import { formatCompact } from "@/lib/utils";
import type { OutreachSettings, OutreachStatus, OutreachTarget } from "@/lib/types";

interface OutreachStats {
  queued: number;
  followed: number;
  followed_back: number;
  skipped: number;
  today_followed: number;
  daily_target: number;
}

type QueueTab = "queued" | "followed" | "followed_back" | "skipped";

const TAB_OPTIONS: Array<{ value: QueueTab; label: string }> = [
  { value: "queued", label: "Queued" },
  { value: "followed", label: "Followed" },
  { value: "followed_back", label: "Followed back" },
  { value: "skipped", label: "Skipped" },
];

/** Move one target between status buckets in the cached stats. */
function shiftStats(stats: OutreachStats, from: OutreachStatus, to: OutreachStatus): OutreachStats {
  const bucket = (s: OutreachStatus): QueueTab | null =>
    s === "queued" || s === "followed" || s === "followed_back" || s === "skipped" ? s : null;
  const next = { ...stats };
  const f = bucket(from);
  const t = bucket(to);
  if (f) next[f] = Math.max(0, next[f] - 1);
  if (t) next[t] += 1;
  if (to === "followed" && from !== "followed") next.today_followed += 1;
  return next;
}

export default function OutreachPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [targets, setTargets] = useState<OutreachTarget[]>([]);
  const [stats, setStats] = useState<OutreachStats | null>(null);

  const [tab, setTab] = useState<QueueTab>("queued");
  const [busyId, setBusyId] = useState<string | null>(null);

  // Import
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);
  const importCardRef = useRef<HTMLDivElement>(null);

  // Session
  const [sessionOpen, setSessionOpen] = useState(false);

  // Enrichment
  const [selected, setSelected] = useState<string[]>([]);
  const [enriching, setEnriching] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  // Notes editor
  const [notesTarget, setNotesTarget] = useState<OutreachTarget | null>(null);
  const [notesDraft, setNotesDraft] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Settings
  const [dailyTargetDraft, setDailyTargetDraft] = useState("");
  const [savingSettings, setSavingSettings] = useState(false);
  const [settingsSaved, setSettingsSaved] = useState(false);

  async function load() {
    const res = await fetch("/api/outreach?limit=500");
    if (!res.ok) throw new Error("Could not load the outreach pipeline. Refresh to try again.");
    const json = (await res.json()) as { targets: OutreachTarget[]; stats: OutreachStats };
    setTargets(json.targets ?? []);
    setStats(json.stats ?? null);
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        await load();
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Something went wrong");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Seed the settings input once stats arrive (without clobbering edits on refetch).
  useEffect(() => {
    if (stats && dailyTargetDraft === "") setDailyTargetDraft(String(stats.daily_target));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stats]);

  const queue = useMemo(() => targets.filter((t) => t.status === "queued"), [targets]);
  const visible = useMemo(() => targets.filter((t) => t.status === tab), [targets, tab]);

  const dailyTarget = stats?.daily_target ?? 30;
  const todayFollowed = stats?.today_followed ?? 0;
  const targetHit = dailyTarget > 0 && todayFollowed >= dailyTarget;
  const totalFollowed = (stats?.followed ?? 0) + (stats?.followed_back ?? 0);
  const conversion = totalFollowed > 0 ? Math.round(((stats?.followed_back ?? 0) / totalFollowed) * 100) : 0;

  async function patchTarget(target: OutreachTarget, body: Record<string, unknown>): Promise<boolean> {
    setBusyId(target.id);
    try {
      const res = await fetch(`/api/outreach/${target.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return false;
      const json = (await res.json()) as { target: OutreachTarget };
      setTargets((prev) => prev.map((t) => (t.id === json.target.id ? json.target : t)));
      if (typeof body.status === "string" && body.status !== target.status) {
        setStats((prev) =>
          prev ? shiftStats(prev, target.status, body.status as OutreachStatus) : prev,
        );
      }
      return true;
    } finally {
      setBusyId(null);
    }
  }

  async function sessionAction(target: OutreachTarget, status: "followed" | "skipped", notes: string) {
    const body: Record<string, unknown> = { status };
    const trimmed = notes.trim();
    if (trimmed && trimmed !== (target.notes ?? "")) body.notes = trimmed;
    await patchTarget(target, body);
  }

  async function runImport() {
    if (!importText.trim() || importing) return;
    setImporting(true);
    setImportMsg(null);
    try {
      const res = await fetch("/api/outreach/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });
      const json = (await res.json()) as { added?: number; duplicates?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Import failed");
      setImportMsg(`+${json.added ?? 0} added, ${json.duplicates ?? 0} duplicates skipped`);
      setImportText("");
      await load();
    } catch (e) {
      setImportMsg(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function toggleSelect(id: string) {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length >= 20 ? prev : [...prev, id],
    );
  }

  function selectNextBatch() {
    setSelected(
      visible
        .filter((t) => t.followers_count === null)
        .slice(0, 20)
        .map((t) => t.id),
    );
  }

  async function runEnrich() {
    if (selected.length === 0 || enriching) return;
    setEnriching(true);
    setEnrichMsg(null);
    try {
      const res = await fetch("/api/outreach/enrich", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const json = (await res.json()) as { enriched?: number; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Enrichment failed");
      setEnrichMsg(`Enriched ${json.enriched ?? 0} profile${json.enriched === 1 ? "" : "s"}`);
      setSelected([]);
      await load();
    } catch (e) {
      setEnrichMsg(e instanceof Error ? e.message : "Enrichment failed");
    } finally {
      setEnriching(false);
    }
  }

  function openNotes(target: OutreachTarget) {
    setNotesTarget(target);
    setNotesDraft(target.notes ?? "");
  }

  async function saveNotes() {
    if (!notesTarget || savingNotes) return;
    setSavingNotes(true);
    try {
      const ok = await patchTarget(notesTarget, { notes: notesDraft.trim() || null });
      if (ok) setNotesTarget(null);
    } finally {
      setSavingNotes(false);
    }
  }

  async function saveSettings() {
    const n = Number(dailyTargetDraft);
    if (!Number.isFinite(n) || n < 1 || savingSettings) return;
    setSavingSettings(true);
    try {
      const res = await fetch("/api/outreach/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ daily_target: Math.round(n) }),
      });
      if (res.ok) {
        const json = (await res.json()) as { settings: OutreachSettings };
        setStats((prev) => (prev ? { ...prev, daily_target: json.settings.daily_target } : prev));
        setDailyTargetDraft(String(json.settings.daily_target));
        setSettingsSaved(true);
        window.setTimeout(() => setSettingsSaved(false), 2500);
      }
    } finally {
      setSavingSettings(false);
    }
  }

  function focusImport() {
    importCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    const textarea = importCardRef.current?.querySelector("textarea");
    if (textarea instanceof HTMLTextAreaElement) textarea.focus();
  }

  function tabEmptyState(current: QueueTab) {
    switch (current) {
      case "queued":
        return (
          <EmptyState
            icon={<ClipboardPaste />}
            title="The queue is empty"
            description="Paste profile links or @handles into the import box — the parser extracts and dedupes usernames from any mess."
            action={
              <Button variant="accent" onClick={focusImport}>
                <ClipboardPaste size={14} />
                Add targets
              </Button>
            }
          />
        );
      case "followed":
        return (
          <EmptyState
            icon={<UserPlus />}
            title="No follows tracked yet"
            description="Run today's session to work the queue one profile at a time — at a pace that keeps your account safe."
            action={
              <Button variant="accent" onClick={() => setSessionOpen(true)}>
                <Play size={14} />
                Start today&apos;s session
              </Button>
            }
          />
        );
      case "followed_back":
        return (
          <EmptyState
            icon={<CheckCheck />}
            title="No follow-backs yet"
            description="When someone follows you back, mark it on the Followed tab — your conversion rate shows up here."
            action={
              <Button variant="outline" onClick={() => setTab("followed")}>
                Review followed
              </Button>
            }
          />
        );
      case "skipped":
        return (
          <EmptyState
            icon={<SkipForward />}
            title="Nothing skipped"
            description="Targets you pass on during a session land here, so the queue stays clean."
            action={
              <Button variant="outline" onClick={() => setSessionOpen(true)}>
                <Play size={14} />
                Start a session
              </Button>
            }
          />
        );
    }
  }

  return (
    <div>
      <PageHeader
        overline="Grow"
        title="Outreach"
        description="Follow pipeline — paste accounts, work the queue at a safe pace."
        actions={
          <Button variant="accent" onClick={() => setSessionOpen(true)}>
            <Play size={16} />
            Start today&apos;s session
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-6 h-6" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Could not load outreach"
          description={loadError}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw size={14} />
              Reload
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-rise">
            <StatCard label="Queue" value={stats?.queued ?? 0} hint="waiting for a session" />
            <StatCard
              label="Followed today"
              value={`${todayFollowed}/${dailyTarget}`}
              hint={
                targetHit
                  ? "daily target hit — good stopping point"
                  : `${Math.max(0, dailyTarget - todayFollowed)} to go at a safe pace`
              }
              accent={targetHit}
            />
            <StatCard
              label="Followed back"
              value={stats?.followed_back ?? 0}
              hint={`${conversion}% conversion`}
            />
            <StatCard label="Total followed" value={totalFollowed} hint="all time" />
          </div>

          {/* Import */}
          <div ref={importCardRef}>
            <Card className="p-6">
              <div className="microlabel mb-1.5">Import targets</div>
              <div className="text-sm text-paper-dim mb-4">
                Drop in a competitor&apos;s commenters, a hashtag crawl, a spreadsheet column — the
                parser handles the cleanup and dedupes.
              </div>
              <Textarea
                placeholder="Paste Instagram links, @handles, or usernames — any mess works"
                className="min-h-32 font-mono text-xs"
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
              />
              <div className="flex items-center gap-3 mt-4">
                <Button
                  variant="primary"
                  disabled={importing || !importText.trim()}
                  onClick={() => void runImport()}
                >
                  {importing ? <Spinner className="w-3.5 h-3.5" /> : <ClipboardPaste size={15} />}
                  Import
                </Button>
                {importMsg ? <span className="text-xs text-lime">{importMsg}</span> : null}
              </div>
            </Card>
          </div>

          {/* Session launcher */}
          <Card className="px-6 py-5 flex flex-wrap items-center gap-6">
            <div className="flex-1 min-w-56">
              <div className="microlabel mb-1.5">Session mode</div>
              <div className="display text-lg text-paper">Work the queue, one profile at a time</div>
              <div className="text-xs text-paper-dim mt-1">
                Open the profile, tap Follow inside Instagram yourself, mark it here. Keyboard: F
                followed · S skip · O open.
              </div>
            </div>
            <div className="w-44 shrink-0">
              <div className="flex items-baseline justify-between mb-1.5">
                <span className="stat-number text-2xl text-paper">{todayFollowed}</span>
                <span className="text-xs text-muted">of {dailyTarget} today</span>
              </div>
              <div className="h-1.5 rounded-full bg-ink-3 overflow-hidden">
                <div
                  className="h-full bg-accent transition-all duration-150 ease-out"
                  style={{
                    width: `${dailyTarget > 0 ? Math.min(100, (todayFollowed / dailyTarget) * 100) : 0}%`,
                  }}
                />
              </div>
            </div>
            <Button variant="accent" size="lg" className="shrink-0" onClick={() => setSessionOpen(true)}>
              <Play size={16} />
              Start today&apos;s session
            </Button>
          </Card>

          {/* Queue table */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <Tabs
                value={tab}
                onChange={(v) => {
                  setTab(v);
                  setSelected([]);
                  setEnrichMsg(null);
                }}
                options={TAB_OPTIONS.map((o) => {
                  const count = stats ? stats[o.value] : 0;
                  return { value: o.value, label: `${o.label} (${count})` };
                })}
              />
              {tab === "queued" && visible.length > 0 ? (
                <div className="flex items-center gap-2">
                  {enrichMsg ? <span className="text-xs text-paper-dim">{enrichMsg}</span> : null}
                  <Button size="sm" variant="ghost" onClick={selectNextBatch}>
                    Select next 20
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={selected.length === 0 || enriching}
                    onClick={() => void runEnrich()}
                  >
                    {enriching ? <Spinner className="w-3 h-3" /> : <Sparkles size={13} />}
                    Enrich{selected.length > 0 ? ` (${selected.length})` : ""}
                  </Button>
                </div>
              ) : null}
            </div>

            {visible.length === 0 ? (
              tabEmptyState(tab)
            ) : (
              <Card className="divide-y divide-line overflow-hidden">
                {visible.map((t) => (
                  <div key={t.id} className="flex items-center gap-4 px-5 py-3 min-w-0">
                    {tab === "queued" ? (
                      <input
                        type="checkbox"
                        checked={selected.includes(t.id)}
                        onChange={() => toggleSelect(t.id)}
                        className="w-4 h-4 shrink-0 cursor-pointer accent-accent"
                        aria-label={`Select @${t.username}`}
                      />
                    ) : null}
                    <div className="flex-1 min-w-0">
                      <a
                        href={`https://instagram.com/${t.username}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-paper hover:text-accent transition-colors"
                      >
                        @{t.username}
                      </a>
                      {t.full_name ? (
                        <span className="text-xs text-muted ml-2 truncate">{t.full_name}</span>
                      ) : null}
                      {t.notes ? (
                        <div className="flex items-center gap-1.5 text-xs text-muted truncate mt-0.5">
                          <StickyNote size={11} className="shrink-0" />
                          <span className="truncate">{t.notes}</span>
                        </div>
                      ) : null}
                    </div>
                    <div className="w-20 shrink-0 text-right">
                      {t.followers_count !== null ? (
                        <>
                          <div className="stat-number text-sm text-paper">
                            {formatCompact(t.followers_count)}
                          </div>
                          <div className="text-[10px] text-muted">followers</div>
                        </>
                      ) : (
                        <span className="text-xs text-muted">—</span>
                      )}
                    </div>
                    <div className="w-16 shrink-0 text-right text-xs text-muted hidden sm:block">
                      {format(new Date(t.created_at), "MMM d")}
                    </div>
                    <Badge tone={statusTone(t.status)} className="shrink-0">
                      {t.status.replace(/_/g, " ")}
                    </Badge>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {t.status === "followed" ? (
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busyId === t.id}
                          onClick={() => void patchTarget(t, { status: "followed_back" })}
                        >
                          {busyId === t.id ? <Spinner className="w-3 h-3" /> : <CheckCheck size={13} />}
                          Followed back
                        </Button>
                      ) : null}
                      <Button size="sm" variant="ghost" onClick={() => openNotes(t)}>
                        <StickyNote size={13} />
                        Notes
                      </Button>
                    </div>
                  </div>
                ))}
              </Card>
            )}
          </section>

          {/* Settings + compliance */}
          <Card className="px-6 py-5 flex flex-col md:flex-row gap-6">
            <div className="flex-1">
              <div className="microlabel mb-3">Pace settings</div>
              <div className="flex items-end gap-2">
                <Field label="Daily target">
                  <Input
                    type="number"
                    min={1}
                    max={1000}
                    className="w-28"
                    value={dailyTargetDraft}
                    onChange={(e) => setDailyTargetDraft(e.target.value)}
                  />
                </Field>
                <Button
                  variant="outline"
                  disabled={savingSettings}
                  onClick={() => void saveSettings()}
                >
                  {savingSettings ? <Spinner className="w-3.5 h-3.5" /> : <Save size={14} />}
                  Save
                </Button>
                {settingsSaved ? <span className="text-xs text-lime pb-3">Saved</span> : null}
              </div>
              <div className="text-xs text-muted mt-2">
                Default is 30 a day. Keep it conservative — the pace is the protection.
              </div>
            </div>
            <div className="flex-1 border-t md:border-t-0 md:border-l border-line pt-5 md:pt-0 md:pl-6">
              <div className="microlabel mb-3">Why manual</div>
              <p className="text-xs text-paper-dim leading-relaxed max-w-md">
                Instagram has no follow API. Postcraft never acts on your account — it queues, paces,
                and tracks while you tap Follow yourself. Automation tools risk action blocks and
                bans.
              </p>
            </div>
          </Card>
        </div>
      )}

      {/* Session modal */}
      <SessionModal
        open={sessionOpen}
        onClose={() => setSessionOpen(false)}
        queue={queue}
        todayFollowed={todayFollowed}
        dailyTarget={dailyTarget}
        busy={busyId !== null}
        onAction={sessionAction}
      />

      {/* Notes modal */}
      <Modal
        open={notesTarget !== null}
        onClose={() => setNotesTarget(null)}
        title={notesTarget ? `Notes — @${notesTarget.username}` : "Notes"}
      >
        <Textarea
          placeholder="Why this account, what to say, where it came from…"
          value={notesDraft}
          onChange={(e) => setNotesDraft(e.target.value)}
        />
        <div className="flex items-center justify-end gap-2 mt-4">
          <Button variant="ghost" onClick={() => setNotesTarget(null)}>
            Cancel
          </Button>
          <Button variant="primary" disabled={savingNotes} onClick={() => void saveNotes()}>
            {savingNotes ? <Spinner className="w-3.5 h-3.5" /> : <Save size={14} />}
            Save notes
          </Button>
        </div>
      </Modal>
    </div>
  );
}
