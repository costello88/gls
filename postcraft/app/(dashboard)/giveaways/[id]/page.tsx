"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  Check,
  Copy,
  Download,
  ExternalLink,
  Gift,
  Hash,
  Heart,
  MessageCircle,
  RefreshCw,
  Timer,
  Trophy,
  UserPlus,
  X,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  statusTone,
} from "@/components/ui/primitives";
import { Modal, Toggle } from "@/components/ui/interactive";
import { cn, timeAgo } from "@/lib/utils";
import type { Giveaway, GiveawayEntry, GiveawayWinner } from "@/lib/types";

function countdown(endsAt: string): { label: string; ended: boolean } {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return { label: "ended", ended: true };
  const d = Math.floor(diff / 86_400_000);
  const h = Math.floor((diff % 86_400_000) / 3_600_000);
  const m = Math.floor((diff % 3_600_000) / 60_000);
  if (d > 0) return { label: `ends in ${d}d ${h}h`, ended: false };
  if (h > 0) return { label: `ends in ${h}h ${m}m`, ended: false };
  return { label: `ends in ${m}m`, ended: false };
}

function CheckMark({ ok }: { ok: boolean }) {
  return ok ? (
    <Check size={13} className="text-lime inline-block" aria-label="passed" />
  ) : (
    <X size={13} className="text-danger inline-block" aria-label="failed" />
  );
}

export default function GiveawayDetailPage() {
  const { id } = useParams<{ id: string }>();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [giveaway, setGiveaway] = useState<Giveaway | null>(null);
  const [entries, setEntries] = useState<GiveawayEntry[]>([]);
  const [winners, setWinners] = useState<GiveawayWinner[]>([]);

  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState<{ imported: number; total: number } | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [drawOpen, setDrawOpen] = useState(false);
  const [drawing, setDrawing] = useState(false);
  const [drawError, setDrawError] = useState<string | null>(null);

  const [eligibleOnly, setEligibleOnly] = useState(false);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/giveaways/${id}`);
      if (!res.ok) throw new Error("Could not load this giveaway.");
      const json = (await res.json()) as {
        giveaway: Giveaway;
        entries: GiveawayEntry[];
        winners: GiveawayWinner[];
      };
      setGiveaway(json.giveaway);
      setEntries(json.entries ?? []);
      setWinners((json.winners ?? []).slice().sort((a, b) => a.draw_index - b.draw_index));
      setLoadError(null);
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  const eligibleCount = useMemo(() => entries.filter((e) => e.eligible).length, [entries]);
  const shownEntries = useMemo(
    () => (eligibleOnly ? entries.filter((e) => e.eligible) : entries),
    [entries, eligibleOnly],
  );

  async function syncEntries() {
    if (syncing) return;
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch(`/api/giveaways/${id}/sync`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as {
        imported?: number;
        total?: number;
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Could not sync entries");
      setSyncResult({ imported: json.imported ?? 0, total: json.total ?? 0 });
      await load();
    } catch (e) {
      setSyncError(e instanceof Error ? e.message : "Could not sync entries");
    } finally {
      setSyncing(false);
    }
  }

  async function drawWinners() {
    if (drawing) return;
    setDrawing(true);
    setDrawError(null);
    try {
      const res = await fetch(`/api/giveaways/${id}/draw`, { method: "POST" });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not draw winners");
      setDrawOpen(false);
      await load();
    } catch (e) {
      setDrawError(e instanceof Error ? e.message : "Could not draw winners");
    } finally {
      setDrawing(false);
    }
  }

  async function copySeed() {
    if (!giveaway?.draw_seed) return;
    try {
      await navigator.clipboard.writeText(giveaway.draw_seed);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // clipboard unavailable — ignore
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner className="w-6 h-6" />
      </div>
    );
  }

  if (loadError || !giveaway) {
    return (
      <EmptyState
        icon={<AlertTriangle />}
        title="Could not load this giveaway"
        description={loadError ?? "It may have been deleted."}
        action={
          <Link href="/giveaways">
            <Button variant="outline">
              Back to giveaways
              <ArrowRight size={14} />
            </Button>
          </Link>
        }
      />
    );
  }

  const req = giveaway.requirements;
  const cd = countdown(giveaway.ends_at);
  const hasActiveChecks = Boolean(req.keyword) || Boolean(req.hashtag) || req.mention_count > 0;

  return (
    <div>
      <PageHeader
        overline="Giveaway"
        title={giveaway.title}
        description={`Prize: ${giveaway.prize}`}
        actions={
          <>
            <Badge tone={statusTone(giveaway.status)} className="capitalize">
              {giveaway.status}
            </Badge>
            {giveaway.status !== "drawn" ? (
              <Badge tone={cd.ended ? "neutral" : "accent"}>
                <Timer size={11} />
                {cd.label}
              </Badge>
            ) : null}
            <Button variant="outline" onClick={syncEntries} disabled={syncing}>
              {syncing ? <Spinner className="w-3.5 h-3.5" /> : <RefreshCw size={14} />}
              Sync entries
            </Button>
            <a href={`/api/giveaways/${giveaway.id}/export`} download>
              <Button variant="outline">
                <Download size={14} />
                Export CSV
              </Button>
            </a>
            {giveaway.status !== "drawn" ? (
              <Button variant="accent" onClick={() => setDrawOpen(true)}>
                <Trophy size={15} />
                Draw winners
              </Button>
            ) : null}
          </>
        }
      />

      <div className="grid lg:grid-cols-[minmax(0,1fr)_300px] gap-6 items-start">
        <div className="flex flex-col gap-6 min-w-0">
          {syncResult ? (
            <Card className="px-5 py-3.5 flex items-center gap-3 animate-rise">
              <RefreshCw size={15} className="text-lime shrink-0" />
              <div className="text-sm text-paper-dim">
                Imported <span className="text-paper stat-number">{syncResult.imported}</span> new{" "}
                {syncResult.imported === 1 ? "entry" : "entries"} ·{" "}
                <span className="text-paper stat-number">{syncResult.total}</span> total on the post.
              </div>
            </Card>
          ) : null}
          {syncError ? (
            <Card className="px-5 py-3.5 flex items-center gap-3">
              <AlertTriangle size={15} className="text-danger shrink-0" />
              <div className="text-sm text-danger/90">{syncError}</div>
            </Card>
          ) : null}

          {/* Winner reveal */}
          {winners.length > 0 ? (
            <section className="flex flex-col gap-3">
              <div className="microlabel">
                Winner{winners.length === 1 ? "" : "s"}
                {giveaway.drawn_at ? ` · drawn ${timeAgo(giveaway.drawn_at)}` : ""}
              </div>
              {winners.map((w, i) => (
                <Card key={w.id} className="p-6 grain relative overflow-hidden flex items-center gap-6 animate-rise">
                  <div className="w-14 h-14 rounded-full ig-ring p-[3px] shrink-0">
                    <div className="w-full h-full rounded-full bg-ink-2 flex items-center justify-center">
                      <Trophy size={20} className="text-accent" />
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="microlabel">
                      Winner {i + 1} of {winners.length}
                    </div>
                    <div className="display text-3xl text-paper truncate mt-1">@{w.username}</div>
                  </div>
                  <a
                    href={`https://instagram.com/${w.username}`}
                    target="_blank"
                    rel="noreferrer"
                    className="shrink-0"
                  >
                    <Button variant="outline" size="sm">
                      View profile
                      <ExternalLink size={13} />
                    </Button>
                  </a>
                </Card>
              ))}
              {giveaway.draw_seed ? (
                <Card className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="min-w-0">
                      <div className="microlabel mb-1">Verification seed</div>
                      <code className="font-mono text-xs text-paper-dim break-all">{giveaway.draw_seed}</code>
                    </div>
                    <Button size="sm" variant="ghost" onClick={copySeed} className="shrink-0">
                      {copied ? <Check size={13} className="text-lime" /> : <Copy size={13} />}
                      {copied ? "Copied" : "Copy"}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted mt-2">
                    Re-running the draw with this seed reproduces the exact same winners — share it to
                    prove the draw was fair.
                  </p>
                </Card>
              ) : null}
            </section>
          ) : null}

          {/* Entries */}
          <section>
            <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
              <div className="microlabel">
                Entries · <span className="text-paper">{entries.length}</span> total ·{" "}
                <span className="text-paper">{eligibleCount}</span> eligible
              </div>
              <Toggle checked={eligibleOnly} onChange={setEligibleOnly} label="Eligible only" />
            </div>
            {entries.length === 0 ? (
              <EmptyState
                icon={<AtSign />}
                title="No entries synced yet"
                description="Sync pulls the comments from the giveaway post and checks each one against your rules — a comment is an entry."
                action={
                  <Button variant="accent" size="sm" onClick={syncEntries} disabled={syncing}>
                    {syncing ? <Spinner className="w-3 h-3" /> : <RefreshCw size={14} />}
                    Sync entries
                  </Button>
                }
              />
            ) : (
              <Card className="overflow-x-auto animate-rise">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-line">
                      <th className="microlabel text-left px-4 py-2.5 font-medium whitespace-nowrap">
                        Username
                      </th>
                      <th className="microlabel text-left px-4 py-2.5 font-medium">Comment</th>
                      {req.keyword ? (
                        <th className="microlabel text-center px-3 py-2.5 font-medium whitespace-nowrap">
                          Keyword
                        </th>
                      ) : null}
                      {req.hashtag ? (
                        <th className="microlabel text-center px-3 py-2.5 font-medium whitespace-nowrap">
                          Hashtag
                        </th>
                      ) : null}
                      {req.mention_count > 0 ? (
                        <th className="microlabel text-center px-3 py-2.5 font-medium whitespace-nowrap">
                          Tags ≥ {req.mention_count}
                        </th>
                      ) : null}
                      <th className="microlabel text-right px-4 py-2.5 font-medium whitespace-nowrap">
                        Eligible
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {shownEntries.map((entry) => (
                      <tr key={entry.id}>
                        <td className="px-4 py-2.5 whitespace-nowrap">
                          <a
                            href={`https://instagram.com/${entry.username}`}
                            target="_blank"
                            rel="noreferrer"
                            className="text-paper hover:text-accent transition-colors"
                          >
                            @{entry.username}
                          </a>
                        </td>
                        <td
                          className="px-4 py-2.5 text-paper-dim max-w-[320px] truncate"
                          title={entry.text}
                        >
                          {entry.text}
                        </td>
                        {req.keyword ? (
                          <td className="px-3 py-2.5 text-center">
                            <CheckMark ok={entry.checks.hasKeyword} />
                          </td>
                        ) : null}
                        {req.hashtag ? (
                          <td className="px-3 py-2.5 text-center">
                            <CheckMark ok={entry.checks.hasHashtag} />
                          </td>
                        ) : null}
                        {req.mention_count > 0 ? (
                          <td className="px-3 py-2.5 text-center">
                            <span className="inline-flex items-center gap-1.5">
                              <CheckMark ok={entry.checks.mentionOk} />
                              <span className="text-[11px] text-muted stat-number">{entry.mention_count}</span>
                            </span>
                          </td>
                        ) : null}
                        <td className="px-4 py-2.5 text-right">
                          <Badge tone={entry.eligible ? "lime" : "neutral"}>
                            {entry.eligible ? "eligible" : "not eligible"}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
                {shownEntries.length === 0 ? (
                  <div className="px-4 py-6 text-sm text-muted text-center">
                    No eligible entries yet — sync again after more comments come in.
                  </div>
                ) : null}
              </Card>
            )}
          </section>
        </div>

        {/* Requirements sidebar */}
        <aside className="flex flex-col gap-4">
          <Card className="p-5 flex flex-col gap-4">
            <div className="microlabel">Requirements</div>
            <ul className="flex flex-col gap-3">
              {req.must_follow ? (
                <li className="flex items-start gap-2.5 text-sm text-paper-dim">
                  <UserPlus size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>
                    Follow the account{" "}
                    <Badge tone="warn" className="ml-1">
                      honor system
                    </Badge>
                  </span>
                </li>
              ) : null}
              {req.must_like ? (
                <li className="flex items-start gap-2.5 text-sm text-paper-dim">
                  <Heart size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>
                    Like the post{" "}
                    <Badge tone="warn" className="ml-1">
                      honor system
                    </Badge>
                  </span>
                </li>
              ) : null}
              {req.mention_count > 0 ? (
                <li className="flex items-start gap-2.5 text-sm text-paper-dim">
                  <AtSign size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>
                    Tag at least {req.mention_count} friend{req.mention_count > 1 ? "s" : ""}
                  </span>
                </li>
              ) : null}
              {req.keyword ? (
                <li className="flex items-start gap-2.5 text-sm text-paper-dim">
                  <MessageCircle size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>
                    Comment with &ldquo;{req.keyword}&rdquo;
                  </span>
                </li>
              ) : null}
              {req.hashtag ? (
                <li className="flex items-start gap-2.5 text-sm text-paper-dim">
                  <Hash size={14} className="text-accent mt-0.5 shrink-0" />
                  <span>Include {req.hashtag.startsWith("#") ? req.hashtag : `#${req.hashtag}`}</span>
                </li>
              ) : null}
              {!req.must_follow && !req.must_like && !hasActiveChecks ? (
                <li className="text-sm text-paper-dim">Anyone who comments is eligible.</li>
              ) : null}
            </ul>
            <p className="text-[11px] text-muted leading-relaxed border-t border-line pt-3">
              Follow and like rules are announced in the giveaway copy but cannot be verified through
              the Instagram API — only comment content (keyword, hashtag, tags) affects machine
              eligibility.
            </p>
          </Card>

          <Card className="p-5 flex flex-col gap-3">
            <div className="microlabel">Status</div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-paper-dim">Entries</span>
              <span className="stat-number text-paper">{entries.length}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-paper-dim">Eligible</span>
              <span className="stat-number text-paper">{eligibleCount}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-paper-dim">Winners to draw</span>
              <span className="stat-number text-paper">{giveaway.winner_count}</span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-paper-dim">Last synced</span>
              <span className="text-paper-dim">
                {giveaway.entries_synced_at ? timeAgo(giveaway.entries_synced_at) : "never"}
              </span>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-paper-dim">Ends</span>
              <span className={cn(cd.ended ? "text-muted" : "text-accent")}>{cd.label}</span>
            </div>
          </Card>
        </aside>
      </div>

      {/* Draw confirm */}
      <Modal
        open={drawOpen}
        onClose={() => {
          if (!drawing) setDrawOpen(false);
        }}
        title="Draw winners"
      >
        <div className="flex flex-col gap-4">
          <p className="text-sm text-paper-dim">
            This closes entries and draws{" "}
            <span className="text-paper stat-number">{giveaway.winner_count}</span> winner
            {giveaway.winner_count === 1 ? "" : "s"} with a verifiable random seed. The seed is stored
            so the draw can be reproduced and audited.
          </p>
          <p className="text-sm text-paper-dim">
            <span className="text-paper stat-number">{eligibleCount}</span> eligible{" "}
            {eligibleCount === 1 ? "entry is" : "entries are"} in the pool.
          </p>
          {eligibleCount === 0 ? (
            <div className="text-sm text-warn flex items-center gap-2">
              <AlertTriangle size={14} />
              No eligible entries — sync entries before drawing.
            </div>
          ) : null}
          {drawError ? <div className="text-sm text-danger">{drawError}</div> : null}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={() => setDrawOpen(false)} disabled={drawing}>
              Cancel
            </Button>
            <Button variant="accent" onClick={drawWinners} disabled={drawing || eligibleCount === 0}>
              {drawing ? <Spinner className="w-3.5 h-3.5" /> : <Trophy size={15} />}
              Close &amp; draw
            </Button>
          </div>
        </div>
      </Modal>

      <span className="hidden">
        <Gift size={0} />
      </span>
    </div>
  );
}
