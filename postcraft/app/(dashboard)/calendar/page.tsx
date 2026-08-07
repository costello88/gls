"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  addMonths,
  addWeeks,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  isToday,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Clapperboard,
  Film,
  Image as ImageIcon,
  Layers,
  RectangleVertical,
  RefreshCw,
  Send,
  Sparkles,
  Trash2,
  type LucideIcon,
} from "lucide-react";
import {
  Badge,
  Button,
  EmptyState,
  Field,
  Input,
  PageHeader,
  Spinner,
  statusTone,
} from "@/components/ui/primitives";
import { Modal, Tabs } from "@/components/ui/interactive";
import { cn } from "@/lib/utils";
import type { IgAccount, Post, PostSurface } from "@/lib/types";

type View = "month" | "week";
type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const SURFACE_ICONS: Record<PostSurface, LucideIcon> = {
  feed: ImageIcon,
  reel: Clapperboard,
  story: RectangleVertical,
  carousel: Layers,
};

/** Chip color classes derived from the shared status→tone mapping. */
function chipClasses(status: string): string {
  switch (statusTone(status)) {
    case "lime":
      return "bg-lime-soft text-lime";
    case "accent":
      return "bg-accent-soft text-accent";
    case "warn":
      return "bg-warn/10 text-warn";
    case "danger":
      return "bg-danger/10 text-danger";
    default:
      return "bg-ink-3 text-paper-dim";
  }
}

export default function CalendarPage() {
  const [view, setView] = useState<View>("month");
  const [cursor, setCursor] = useState<Date>(() => new Date());
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [loading, setLoading] = useState(true);

  const [selected, setSelected] = useState<Post | null>(null);
  const [rescheduleAt, setRescheduleAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const range = useMemo(() => {
    if (view === "month") {
      return {
        start: startOfWeek(startOfMonth(cursor), { weekStartsOn: 1 }),
        end: endOfWeek(endOfMonth(cursor), { weekStartsOn: 1 }),
      };
    }
    return {
      start: startOfWeek(cursor, { weekStartsOn: 1 }),
      end: endOfWeek(cursor, { weekStartsOn: 1 }),
    };
  }, [view, cursor]);

  const fromIso = range.start.toISOString();
  const toIso = range.end.toISOString();

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    fetch(`/api/posts?from=${encodeURIComponent(fromIso)}&to=${encodeURIComponent(toIso)}`)
      .then((r) => (r.ok ? (r.json() as Promise<{ posts: Post[] }>) : Promise.reject(new Error("load"))))
      .then((j) => {
        if (!cancelled) setPosts(j.posts ?? []);
      })
      .catch(() => {
        if (!cancelled) setPosts([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [fromIso, toIso]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/accounts")
      .then((r) => (r.ok ? (r.json() as Promise<{ accounts: AccountRow[] }>) : Promise.reject(new Error("load"))))
      .then((j) => {
        if (!cancelled) setAccounts(j.accounts ?? []);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const accountsById = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const byDay = useMemo(() => {
    const map = new Map<string, Post[]>();
    for (const p of posts) {
      if (!p.scheduled_at) continue;
      const key = format(new Date(p.scheduled_at), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(p);
      map.set(key, list);
    }
    for (const list of map.values()) {
      list.sort(
        (a, b) =>
          new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime(),
      );
    }
    return map;
  }, [posts]);

  const days = useMemo(() => eachDayOfInterval({ start: range.start, end: range.end }), [range]);

  const rangeLabel =
    view === "month"
      ? format(cursor, "MMMM yyyy")
      : `${format(range.start, "MMM d")} – ${format(range.end, "MMM d, yyyy")}`;

  function step(dir: 1 | -1) {
    setCursor((c) => (view === "month" ? addMonths(c, dir) : addWeeks(c, dir)));
  }

  function username(accountId: string): string {
    return accountsById.get(accountId)?.username ?? "unknown";
  }

  function openPost(p: Post) {
    setSelected(p);
    setNote(null);
    setRescheduleAt(p.scheduled_at ? format(new Date(p.scheduled_at), "yyyy-MM-dd'T'HH:mm") : "");
  }

  async function patchSelected(body: Record<string, unknown>, doneNote: string) {
    if (!selected) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${selected.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => null)) as { error?: string } | null;
        setNote(j?.error ?? "Update failed");
        return;
      }
      const { post } = (await res.json()) as { post: Post };
      setPosts((prev) => prev.map((p) => (p.id === post.id ? post : p)));
      setSelected(post);
      setNote(doneNote);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSelected() {
    if (!selected) return;
    if (!window.confirm("Delete this post? This cannot be undone.")) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/posts/${selected.id}`, { method: "DELETE" });
      if (res.ok) {
        setPosts((prev) => prev.filter((p) => p.id !== selected.id));
        setSelected(null);
      } else {
        setNote("Delete failed");
      }
    } finally {
      setBusy(false);
    }
  }

  const selectedEditable =
    selected !== null && selected.status !== "published" && selected.status !== "publishing";

  return (
    <div>
      <PageHeader
        overline="Postcraft · Schedule"
        title="Calendar"
        description="Every scheduled post across every account. Click a slot to reschedule, retry, or ship it now."
        actions={
          <Link href="/create">
            <Button variant="accent">
              <Sparkles size={16} />
              New post
            </Button>
          </Link>
        }
      />

      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => step(-1)} aria-label="Previous">
            <ChevronLeft size={14} />
          </Button>
          <Button variant="outline" size="sm" onClick={() => setCursor(new Date())}>
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={() => step(1)} aria-label="Next">
            <ChevronRight size={14} />
          </Button>
          <span className="display text-lg text-paper ml-2">{rangeLabel}</span>
          {loading ? <Spinner className="ml-2" /> : null}
        </div>
        <Tabs<View>
          value={view}
          onChange={setView}
          options={[
            { value: "month", label: "Month" },
            { value: "week", label: "Week" },
          ]}
        />
      </div>

      {view === "month" ? (
        <div className="card overflow-hidden animate-rise">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d) => (
              <div key={d} className="microlabel px-3 py-2.5 text-center">
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-px bg-line">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayPosts = byDay.get(key) ?? [];
              const inMonth = isSameMonth(day, cursor);
              return (
                <div
                  key={key}
                  className={cn(
                    "bg-ink-2 min-h-28 p-1.5 flex flex-col gap-1 group",
                    !inMonth && "opacity-40",
                  )}
                >
                  <div
                    className={cn(
                      "text-xs px-1 stat-number",
                      isToday(day) ? "text-accent font-bold" : "text-paper-dim",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  {dayPosts.slice(0, 3).map((p) => {
                    const Icon = SURFACE_ICONS[p.surface];
                    return (
                      <button
                        key={p.id}
                        onClick={() => openPost(p)}
                        title={`@${username(p.account_id)} · ${p.surface} · ${p.status}`}
                        className={cn(
                          "w-full flex items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-semibold text-left cursor-pointer transition-all hover:brightness-125",
                          chipClasses(p.status),
                        )}
                      >
                        <span className="tabular-nums shrink-0">
                          {p.scheduled_at ? format(new Date(p.scheduled_at), "HH:mm") : "--:--"}
                        </span>
                        <Icon size={11} className="shrink-0" />
                        <span className="w-4 h-4 rounded-full bg-ink/50 flex items-center justify-center text-[9px] uppercase shrink-0">
                          {username(p.account_id).charAt(0)}
                        </span>
                      </button>
                    );
                  })}
                  {dayPosts.length > 3 ? (
                    <button
                      onClick={() => {
                        setCursor(day);
                        setView("week");
                      }}
                      className="text-[10px] text-muted hover:text-paper text-left px-1 cursor-pointer"
                    >
                      +{dayPosts.length - 3} more
                    </button>
                  ) : null}
                  {dayPosts.length === 0 ? (
                    <Link
                      href="/create"
                      className="mt-auto opacity-0 group-hover:opacity-100 transition-opacity inline-flex items-center gap-1 px-1 py-0.5 text-[10px] text-paper-dim hover:text-paper"
                    >
                      <Sparkles size={10} />
                      Plan my day
                    </Link>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 xl:grid-cols-7 gap-3 animate-rise">
          {days.map((day) => {
            const key = format(day, "yyyy-MM-dd");
            const dayPosts = byDay.get(key) ?? [];
            return (
              <div key={key} className="flex flex-col gap-2 min-w-0">
                <div
                  className={cn(
                    "px-1 pb-1.5 border-b",
                    isToday(day) ? "border-accent" : "border-line",
                  )}
                >
                  <div className="microlabel">{format(day, "EEE")}</div>
                  <div
                    className={cn(
                      "stat-number text-xl",
                      isToday(day) ? "text-accent" : "text-paper",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                </div>
                {dayPosts.map((p) => {
                  const Icon = SURFACE_ICONS[p.surface];
                  const firstMedia = p.media_urls[0];
                  return (
                    <button
                      key={p.id}
                      onClick={() => openPost(p)}
                      className="card card-hover p-3 text-left cursor-pointer flex flex-col gap-2 min-w-0"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-xs tabular-nums text-paper font-semibold">
                          {p.scheduled_at ? format(new Date(p.scheduled_at), "HH:mm") : "--:--"}
                        </span>
                        <Badge tone={statusTone(p.status)} className="capitalize">
                          {p.status}
                        </Badge>
                      </div>
                      {firstMedia ? (
                        firstMedia.endsWith(".mp4") ? (
                          <div className="h-16 rounded-md bg-ink-3 flex items-center justify-center text-muted">
                            <Film size={16} />
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={firstMedia}
                            alt=""
                            className="h-16 w-full object-cover rounded-md"
                          />
                        )
                      ) : null}
                      <div className="text-xs text-paper-dim line-clamp-2">
                        {p.caption ? p.caption : "(no caption yet)"}
                      </div>
                      <div className="flex items-center gap-1.5 text-[11px] text-muted min-w-0">
                        <Icon size={12} className="shrink-0" />
                        <span className="capitalize shrink-0">{p.surface}</span>
                        <span className="truncate">· @{username(p.account_id)}</span>
                      </div>
                    </button>
                  );
                })}
                {dayPosts.length === 0 ? (
                  <Link
                    href="/create"
                    className="border border-dashed border-line-2 rounded-lg px-3 py-4 text-center text-[11px] text-muted hover:text-paper hover:border-paper/40 transition-colors inline-flex items-center justify-center gap-1.5"
                  >
                    <Sparkles size={11} />
                    Plan my day
                  </Link>
                ) : null}
              </div>
            );
          })}
        </div>
      )}

      {!loading && posts.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            icon={<CalendarDays />}
            title="Nothing on the calendar for this range"
            description="A quiet calendar is a quiet account. Create a post and drop it on a slot — or let a campaign fill the whole week."
            action={
              <div className="flex items-center gap-2">
                <Link href="/create">
                  <Button variant="accent" size="sm">
                    <Sparkles size={14} />
                    Create post
                  </Button>
                </Link>
                <Link href="/campaigns">
                  <Button variant="outline" size="sm">
                    Plan a campaign
                  </Button>
                </Link>
              </div>
            }
          />
        </div>
      ) : null}

      {/* Post detail modal */}
      <Modal open={selected !== null} onClose={() => setSelected(null)} title="Post detail" wide>
        {selected ? (
          <div className="flex flex-col gap-5">
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={statusTone(selected.status)} className="capitalize">
                {selected.status}
              </Badge>
              <Badge tone="neutral" className="capitalize">
                {selected.surface}
              </Badge>
              <span className="text-sm text-paper-dim">@{username(selected.account_id)}</span>
              <span className="text-sm text-muted ml-auto tabular-nums">
                {selected.scheduled_at
                  ? format(new Date(selected.scheduled_at), "EEE, MMM d · HH:mm")
                  : "not scheduled"}
              </span>
            </div>

            {selected.media_urls.length > 0 ? (
              <div className="flex gap-2 overflow-x-auto">
                {selected.media_urls.map((url) =>
                  url.endsWith(".mp4") ? (
                    <div
                      key={url}
                      className="w-20 h-24 shrink-0 rounded-lg bg-ink-3 flex items-center justify-center text-muted"
                    >
                      <Film size={18} />
                    </div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      key={url}
                      src={url}
                      alt="Design"
                      className="w-20 h-24 shrink-0 object-cover rounded-lg border border-line"
                    />
                  ),
                )}
              </div>
            ) : (
              <div className="border border-dashed border-line-2 rounded-lg px-4 py-5 text-center text-xs text-muted">
                No media attached yet — attach a design in{" "}
                <Link href="/create" className="text-accent hover:underline">
                  Create
                </Link>
                .
              </div>
            )}

            <div className="bg-ink-3 rounded-lg p-4">
              <div className="text-sm text-paper whitespace-pre-wrap leading-relaxed">
                {selected.caption ? selected.caption : "(no caption yet)"}
              </div>
              {selected.hashtags.length > 0 ? (
                <div className="text-xs text-accent mt-2 break-words">
                  {selected.hashtags.map((h) => (h.startsWith("#") ? h : `#${h}`)).join(" ")}
                </div>
              ) : null}
            </div>

            {selected.status === "failed" && selected.error ? (
              <div className="bg-danger/10 border border-danger/30 rounded-lg px-4 py-3 text-xs text-danger">
                {selected.error}
              </div>
            ) : null}

            {selectedEditable ? (
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <Field label="Reschedule">
                    <Input
                      type="datetime-local"
                      value={rescheduleAt}
                      onChange={(e) => setRescheduleAt(e.target.value)}
                    />
                  </Field>
                </div>
                <Button
                  variant="outline"
                  disabled={busy || !rescheduleAt}
                  onClick={() =>
                    patchSelected(
                      { scheduled_at: new Date(rescheduleAt).toISOString() },
                      "Rescheduled.",
                    )
                  }
                >
                  Save
                </Button>
              </div>
            ) : null}

            <div className="flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {selected.status === "scheduled" || selected.status === "draft" ? (
                <Button
                  variant="accent"
                  size="sm"
                  disabled={busy}
                  onClick={() =>
                    patchSelected(
                      selected.status === "draft"
                        ? { status: "scheduled", scheduled_at: new Date().toISOString() }
                        : { scheduled_at: new Date().toISOString() },
                      "Queued for next dispatch.",
                    )
                  }
                >
                  <Send size={13} />
                  Publish now
                </Button>
              ) : null}
              {selected.status === "failed" ? (
                <Button
                  variant="outline"
                  size="sm"
                  disabled={busy}
                  onClick={() => patchSelected({ status: "scheduled" }, "Retry queued.")}
                >
                  <RefreshCw size={13} />
                  Retry
                </Button>
              ) : null}
              <Button variant="danger" size="sm" disabled={busy} onClick={deleteSelected}>
                <Trash2 size={13} />
                Delete
              </Button>
              <span className="ml-auto text-xs text-paper-dim inline-flex items-center gap-2">
                {busy ? <Spinner className="w-3 h-3" /> : null}
                {note}
              </span>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  );
}
