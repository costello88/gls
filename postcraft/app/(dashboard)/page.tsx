"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { format, isToday, startOfWeek } from "date-fns";
import {
  AlertTriangle,
  ArrowRight,
  AtSign,
  CalendarClock,
  CheckCircle2,
  RefreshCw,
  Send,
  Sparkles,
} from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
  statusTone,
} from "@/components/ui/primitives";
import type { IgAccount, Post } from "@/lib/types";

type AccountRow = Omit<IgAccount, "access_token_enc"> & { token_days_left: number | null };

interface OutreachStats {
  queued: number;
  followed: number;
  followed_back: number;
  skipped: number;
  today_followed: number;
  daily_target: number;
}

export default function DashboardPage() {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [posts, setPosts] = useState<Post[]>([]);
  const [accounts, setAccounts] = useState<AccountRow[]>([]);
  const [outreach, setOutreach] = useState<OutreachStats | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [queued, setQueued] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [postsRes, accountsRes, outreachRes] = await Promise.all([
          fetch("/api/posts"),
          fetch("/api/accounts"),
          fetch("/api/outreach?limit=1"),
        ]);
        if (!postsRes.ok || !accountsRes.ok || !outreachRes.ok) {
          throw new Error("Could not load your studio data. Refresh to try again.");
        }
        const postsJson = (await postsRes.json()) as { posts: Post[] };
        const accountsJson = (await accountsRes.json()) as { accounts: AccountRow[] };
        const outreachJson = (await outreachRes.json()) as { stats: OutreachStats };
        if (cancelled) return;
        setPosts(postsJson.posts ?? []);
        setAccounts(accountsJson.accounts ?? []);
        setOutreach(outreachJson.stats ?? null);
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

  const accountsById = useMemo(() => {
    const map = new Map<string, AccountRow>();
    for (const a of accounts) map.set(a.id, a);
    return map;
  }, [accounts]);

  const scheduledToday = useMemo(
    () =>
      posts.filter(
        (p) => p.status === "scheduled" && p.scheduled_at && isToday(new Date(p.scheduled_at)),
      ).length,
    [posts],
  );

  const publishedThisWeek = useMemo(() => {
    const weekStart = startOfWeek(new Date(), { weekStartsOn: 1 });
    return posts.filter(
      (p) => p.status === "published" && p.published_at && new Date(p.published_at) >= weekStart,
    ).length;
  }, [posts]);

  const upNext = useMemo(
    () =>
      posts
        .filter((p) => p.status === "scheduled" && p.scheduled_at)
        .sort(
          (a, b) =>
            new Date(a.scheduled_at as string).getTime() - new Date(b.scheduled_at as string).getTime(),
        )
        .slice(0, 5),
    [posts],
  );

  const failedPosts = useMemo(() => posts.filter((p) => p.status === "failed"), [posts]);

  const problemAccounts = useMemo(
    () =>
      accounts.filter(
        (a) => a.status === "token_expiring" || a.status === "token_expired" || a.status === "error",
      ),
    [accounts],
  );

  async function patchPost(id: string, body: Record<string, unknown>): Promise<Post | null> {
    setBusyId(id);
    try {
      const res = await fetch(`/api/posts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) return null;
      const json = (await res.json()) as { post: Post };
      setPosts((prev) => prev.map((p) => (p.id === id ? json.post : p)));
      return json.post;
    } finally {
      setBusyId(null);
    }
  }

  async function publishNow(post: Post) {
    const updated = await patchPost(post.id, { scheduled_at: new Date().toISOString() });
    if (updated) setQueued((prev) => ({ ...prev, [post.id]: true }));
  }

  async function retryPost(post: Post) {
    await patchPost(post.id, { status: "scheduled" });
  }

  function accountLabel(accountId: string): string {
    const a = accountsById.get(accountId);
    return a ? `@${a.username}` : "unknown";
  }

  const today = new Date();
  const hasAccounts = accounts.length > 0;
  const hasPosts = posts.length > 0;
  const allClear = failedPosts.length === 0 && problemAccounts.length === 0;

  return (
    <div>
      <PageHeader
        overline={`Postcraft · ${format(today, "EEEE")}`}
        title="Today"
        description="Your production line at a glance — what ships next, what needs a hand."
        actions={
          <Link href="/create">
            <Button variant="accent">
              <Sparkles size={16} />
              Create post
            </Button>
          </Link>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Spinner className="w-6 h-6" />
        </div>
      ) : loadError ? (
        <EmptyState
          icon={<AlertTriangle />}
          title="Could not load the dashboard"
          description={loadError}
          action={
            <Button variant="outline" onClick={() => window.location.reload()}>
              <RefreshCw size={14} />
              Reload
            </Button>
          }
        />
      ) : (
        <div className="flex flex-col gap-10">
          {/* Stats */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 animate-rise">
            <StatCard
              label="Scheduled today"
              value={scheduledToday}
              hint="posts leaving the studio"
              accent={scheduledToday > 0}
            />
            <StatCard label="Published this week" value={publishedThisWeek} hint="since Monday" />
            <StatCard
              label="Connected accounts"
              value={accounts.length}
              hint={`${accounts.filter((a) => a.status === "active").length} active`}
            />
            <StatCard
              label="Outreach queue"
              value={outreach?.queued ?? 0}
              hint={
                outreach
                  ? `${outreach.today_followed}/${outreach.daily_target} followed today`
                  : "no session yet"
              }
            />
          </div>

          {!hasAccounts ? (
            <EmptyState
              icon={<AtSign />}
              title="Connect your first Instagram account"
              description="Postcraft publishes through the official Instagram API. Connect a professional (Business or Creator) account to start the machine."
              action={
                <Link href="/accounts">
                  <Button variant="accent">
                    Connect an account
                    <ArrowRight size={14} />
                  </Button>
                </Link>
              }
            />
          ) : !hasPosts ? (
            <EmptyState
              icon={<Sparkles />}
              title="Create your first post"
              description="Upload a picture and a one-line brief — Postcraft turns it into design variants, writes the caption, and schedules it to any account."
              action={
                <Link href="/create">
                  <Button variant="accent">
                    <Sparkles size={14} />
                    Start creating
                  </Button>
                </Link>
              }
            />
          ) : (
            <>
              {/* Up next */}
              <section>
                <div className="flex items-center justify-between mb-3">
                  <div className="microlabel">Up next</div>
                  <Link
                    href="/calendar"
                    className="text-xs text-paper-dim hover:text-paper transition-colors inline-flex items-center gap-1"
                  >
                    View calendar
                    <ArrowRight size={12} />
                  </Link>
                </div>
                {upNext.length === 0 ? (
                  <EmptyState
                    icon={<CalendarClock />}
                    title="Nothing scheduled"
                    description="The queue is empty. Put your next post on the calendar so the machine has something to ship."
                    action={
                      <Link href="/create">
                        <Button variant="accent" size="sm">
                          <Sparkles size={14} />
                          Create post
                        </Button>
                      </Link>
                    }
                  />
                ) : (
                  <Card className="divide-y divide-line overflow-hidden">
                    {upNext.map((post) => (
                      <div key={post.id} className="flex items-center gap-4 px-5 py-3.5 min-w-0">
                        <div className="w-24 shrink-0">
                          <div className="text-sm text-paper stat-number">
                            {post.scheduled_at ? format(new Date(post.scheduled_at), "HH:mm") : "—"}
                          </div>
                          <div className="text-[11px] text-muted">
                            {post.scheduled_at ? format(new Date(post.scheduled_at), "EEE, MMM d") : ""}
                          </div>
                        </div>
                        <div className="w-32 shrink-0 text-xs text-paper-dim truncate">
                          {accountLabel(post.account_id)}
                        </div>
                        <Badge tone="neutral" className="shrink-0 capitalize">
                          {post.surface}
                        </Badge>
                        <div className="flex-1 min-w-0 text-sm text-paper-dim truncate">
                          {post.caption ? post.caption.split("\n")[0] : "(no caption yet)"}
                        </div>
                        <Badge tone={statusTone(post.status)} className="shrink-0 capitalize">
                          {post.status}
                        </Badge>
                        {queued[post.id] ? (
                          <span className="text-[11px] text-lime shrink-0 inline-flex items-center gap-1">
                            <CheckCircle2 size={12} />
                            queued for next dispatch
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant="outline"
                            className="shrink-0"
                            disabled={busyId === post.id}
                            onClick={() => publishNow(post)}
                          >
                            {busyId === post.id ? <Spinner className="w-3 h-3" /> : <Send size={13} />}
                            Publish now
                          </Button>
                        )}
                      </div>
                    ))}
                  </Card>
                )}
              </section>

              {/* Needs attention */}
              <section>
                <div className="microlabel mb-3">Needs attention</div>
                {allClear ? (
                  <Card className="px-5 py-4 flex items-center gap-3">
                    <CheckCircle2 size={16} className="text-lime shrink-0" />
                    <div className="text-sm text-paper-dim">
                      All clear — no failed posts, all account tokens healthy.
                    </div>
                  </Card>
                ) : (
                  <div className="flex flex-col gap-3">
                    {failedPosts.map((post) => (
                      <Card key={post.id} className="px-5 py-4 flex items-center gap-4 min-w-0">
                        <AlertTriangle size={16} className="text-danger shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-paper truncate">
                            {accountLabel(post.account_id)} · <span className="capitalize">{post.surface}</span> ·{" "}
                            {post.caption ? post.caption.split("\n")[0] : "(no caption)"}
                          </div>
                          <div className="text-xs text-danger/80 truncate mt-0.5">
                            {post.error ?? "Publishing failed"}
                          </div>
                        </div>
                        <Badge tone={statusTone(post.status)} className="shrink-0 capitalize">
                          {post.status}
                        </Badge>
                        <Button
                          size="sm"
                          variant="outline"
                          className="shrink-0"
                          disabled={busyId === post.id}
                          onClick={() => retryPost(post)}
                        >
                          {busyId === post.id ? <Spinner className="w-3 h-3" /> : <RefreshCw size={13} />}
                          Retry
                        </Button>
                      </Card>
                    ))}
                    {problemAccounts.map((account) => (
                      <Card key={account.id} className="px-5 py-4 flex items-center gap-4 min-w-0">
                        <AtSign size={16} className="text-warn shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm text-paper truncate">@{account.username}</div>
                          <div className="text-xs text-paper-dim mt-0.5">
                            {account.status === "token_expired"
                              ? "Access token expired — reconnect to keep publishing."
                              : account.status === "token_expiring"
                                ? `Token expires ${
                                    account.token_days_left !== null
                                      ? `in ${account.token_days_left}d`
                                      : "soon"
                                  } — a refresh is due.`
                                : "Account needs a look."}
                          </div>
                        </div>
                        <Badge tone={statusTone(account.status)} className="shrink-0">
                          {account.status.replace("_", " ")}
                        </Badge>
                        <Link href="/accounts">
                          <Button size="sm" variant="outline" className="shrink-0">
                            Fix in Accounts
                            <ArrowRight size={13} />
                          </Button>
                        </Link>
                      </Card>
                    ))}
                  </div>
                )}
              </section>
            </>
          )}
        </div>
      )}
    </div>
  );
}
