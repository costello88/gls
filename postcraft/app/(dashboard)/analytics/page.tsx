"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { BarChart3, RefreshCw } from "lucide-react";
import {
  Badge,
  Button,
  Card,
  EmptyState,
  PageHeader,
  Spinner,
  StatCard,
} from "@/components/ui/primitives";
import { formatCompact, cn } from "@/lib/utils";
import type { AccountInsightsSnapshot, IgAccount, Post, PostMetrics } from "@/lib/types";

interface Summary {
  accounts: Array<{
    account: Omit<IgAccount, "access_token_enc">;
    latest: AccountInsightsSnapshot | null;
    series: AccountInsightsSnapshot[];
  }>;
  top_posts: Array<Post & { metrics: PostMetrics | null }>;
  heatmap: number[][] | null;
}

const WEEKDAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

export default function AnalyticsPage() {
  const [data, setData] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    const res = await fetch("/api/insights/summary");
    if (res.ok) setData((await res.json()) as Summary);
    setLoading(false);
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const sync = async () => {
    setSyncing(true);
    await fetch("/api/insights/sync", { method: "POST" });
    await load();
    setSyncing(false);
  };

  if (loading) {
    return (
      <div className="flex justify-center py-24">
        <Spinner />
      </div>
    );
  }

  const heatMax = data?.heatmap ? Math.max(1, ...data.heatmap.flat()) : 1;

  return (
    <div>
      <PageHeader
        overline="Signal"
        title="Analytics"
        description="What's working, and when your audience is actually awake."
        actions={
          <Button variant="outline" onClick={sync} disabled={syncing}>
            <RefreshCw size={14} className={syncing ? "animate-spin" : ""} /> Sync now
          </Button>
        }
      />

      {!data || data.accounts.length === 0 ? (
        <EmptyState
          icon={<BarChart3 />}
          title="No data yet"
          description="Connect an Instagram account and the daily snapshot will start building your trends and best-time heatmap."
          action={
            <Link href="/accounts">
              <Button variant="accent">Connect an account</Button>
            </Link>
          }
        />
      ) : (
        <div className="flex flex-col gap-8">
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {data.accounts.map(({ account, latest, series }) => {
              const oldest = series[0];
              const delta =
                latest && oldest ? latest.followers_count - oldest.followers_count : 0;
              return (
                <Card key={account.id} className="p-5">
                  <div className="flex items-center justify-between">
                    <span className="microlabel">@{account.username}</span>
                    {latest?.reach_day != null ? (
                      <Badge tone="accent">reach {formatCompact(latest.reach_day)}</Badge>
                    ) : null}
                  </div>
                  <div className="flex items-end gap-3 mt-2">
                    <span className="stat-number text-4xl text-paper">
                      {formatCompact(latest?.followers_count ?? account.followers_count)}
                    </span>
                    {delta !== 0 ? (
                      <span className={cn("text-xs mb-1.5", delta > 0 ? "text-lime" : "text-danger")}>
                        {delta > 0 ? "+" : ""}
                        {formatCompact(delta)} in {series.length}d
                      </span>
                    ) : null}
                  </div>
                  <div className="microlabel mt-1">Followers</div>
                  {series.length >= 2 ? <Sparkline series={series.map((s) => s.followers_count)} /> : null}
                </Card>
              );
            })}
          </div>

          <Card className="p-6">
            <div className="flex items-center justify-between mb-5">
              <div>
                <div className="microlabel">Best time to post</div>
                <div className="text-xs text-muted mt-1">
                  When your followers are online — darker is busier. The scheduler uses this.
                </div>
              </div>
            </div>
            {data.heatmap ? (
              <div className="overflow-x-auto">
                <div className="min-w-[640px]">
                  {data.heatmap.map((row, day) => (
                    <div key={day} className="flex items-center gap-1 mb-1">
                      <span className="microlabel w-9 shrink-0">{WEEKDAYS[day]}</span>
                      {row.map((v, hour) => (
                        <div
                          key={hour}
                          title={`${WEEKDAYS[day]} ${hour}:00 — ${v}`}
                          className="h-5 flex-1 rounded-[3px] min-w-[14px]"
                          style={{
                            background:
                              v > 0
                                ? `rgba(255, 77, 28, ${0.12 + 0.88 * (v / heatMax)})`
                                : "rgba(255,255,255,0.04)",
                          }}
                        />
                      ))}
                    </div>
                  ))}
                  <div className="flex items-center gap-1 mt-1 ml-9">
                    {Array.from({ length: 24 }, (_, hour) => (
                      <span key={hour} className="flex-1 text-center text-[9px] text-muted min-w-[14px]">
                        {hour % 3 === 0 ? hour : ""}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted py-6 text-center">
                No audience-activity data yet — snapshots build this over a few days once an account is
                connected.
              </p>
            )}
          </Card>

          <Card className="p-6">
            <div className="microlabel mb-4">Top posts</div>
            {data.top_posts.length === 0 ? (
              <p className="text-sm text-muted py-4 text-center">
                Publish through Postcraft and your best performers show up here.
              </p>
            ) : (
              <div className="flex flex-col divide-y divide-line">
                {data.top_posts.map((p) => (
                  <div key={p.id} className="flex items-center gap-4 py-3">
                    {p.media_urls[0] ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.media_urls[0]}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover shrink-0"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-ink-3 shrink-0" />
                    )}
                    <div className="min-w-0 flex-1">
                      <div className="text-sm text-paper truncate">{p.caption || "(no caption)"}</div>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge>{p.surface}</Badge>
                        {p.ig_permalink ? (
                          <a
                            href={p.ig_permalink}
                            target="_blank"
                            rel="noreferrer"
                            className="text-[11px] text-accent hover:underline"
                          >
                            View on Instagram ↗
                          </a>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex gap-5 shrink-0">
                      <Metric label="Reach" value={p.metrics?.reach} />
                      <Metric label="Likes" value={p.metrics?.likes} />
                      <Metric label="Saves" value={p.metrics?.saves} />
                      <Metric label="Shares" value={p.metrics?.shares} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard
              label="Tracked accounts"
              value={data.accounts.length}
              hint="daily snapshots at 03:00 UTC"
            />
            <StatCard
              label="Posts measured"
              value={data.top_posts.length}
              hint="published via Postcraft"
            />
            <StatCard
              label="Total reach (top 10)"
              value={formatCompact(data.top_posts.reduce((sum, p) => sum + (p.metrics?.reach ?? 0), 0))}
            />
            <StatCard
              label="Total saves (top 10)"
              value={formatCompact(data.top_posts.reduce((sum, p) => sum + (p.metrics?.saves ?? 0), 0))}
              hint="the highest-value signal"
              accent
            />
          </div>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | undefined }) {
  return (
    <div className="text-right w-14">
      <div className="stat-number text-base text-paper">{value != null ? formatCompact(value) : "—"}</div>
      <div className="microlabel">{label}</div>
    </div>
  );
}

function Sparkline({ series }: { series: number[] }) {
  const min = Math.min(...series);
  const max = Math.max(...series);
  const range = max - min || 1;
  const points = series
    .map((v, i) => `${(i / (series.length - 1)) * 100},${28 - ((v - min) / range) * 24}`)
    .join(" ");
  return (
    <svg viewBox="0 0 100 32" className="w-full h-16 mt-3" preserveAspectRatio="none">
      <polyline points={points} fill="none" stroke="var(--color-accent)" strokeWidth="1.5" />
    </svg>
  );
}
