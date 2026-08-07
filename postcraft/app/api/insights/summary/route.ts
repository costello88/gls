import { jsonOk, requireUser } from "@/lib/api";
import type { AccountInsightsSnapshot, IgAccount, Post, PostMetrics } from "@/lib/types";

export async function GET() {
  const { supa, error } = await requireUser();
  if (error) return error;

  // Per-account snapshot series (last 30, chronological).
  const { data: accountRows } = await supa
    .from("ig_accounts")
    .select("*")
    .order("connected_at", { ascending: true });
  const igAccounts = (accountRows ?? []) as IgAccount[];

  const accounts = [];
  for (const account of igAccounts) {
    const { data: seriesRows } = await supa
      .from("account_insights")
      .select("*")
      .eq("account_id", account.id)
      .order("captured_at", { ascending: false })
      .limit(30);
    const series = ((seriesRows ?? []) as AccountInsightsSnapshot[]).reverse();
    const { access_token_enc: _token, ...safe } = account;
    accounts.push({
      account: safe,
      latest: series.at(-1) ?? null,
      series,
    });
  }

  // Top published posts by reach, joined with their latest metrics.
  const { data: postRows } = await supa
    .from("posts")
    .select("*")
    .eq("status", "published")
    .order("published_at", { ascending: false })
    .limit(200);
  const posts = (postRows ?? []) as Post[];

  const latestMetrics = new Map<string, PostMetrics>();
  if (posts.length) {
    const { data: metricRows } = await supa
      .from("post_metrics")
      .select("*")
      .in("post_id", posts.map((p) => p.id))
      .order("captured_at", { ascending: false });
    for (const m of (metricRows ?? []) as PostMetrics[]) {
      if (!latestMetrics.has(m.post_id)) latestMetrics.set(m.post_id, m);
    }
  }
  const top_posts = posts
    .map((p) => ({ ...p, metrics: latestMetrics.get(p.id) ?? null }))
    .sort((a, b) => (b.metrics?.reach ?? 0) - (a.metrics?.reach ?? 0))
    .slice(0, 10);

  // Best-time heatmap from the newest snapshot that has online_followers.
  let heatmap: number[][] | null = null;
  const { data: heatRows } = await supa
    .from("account_insights")
    .select("*")
    .not("online_followers", "is", null)
    .order("captured_at", { ascending: false })
    .limit(1);
  const snap = (heatRows?.[0] as AccountInsightsSnapshot | undefined)?.online_followers;
  if (snap) {
    heatmap = Array.from({ length: 7 }, (_, day) =>
      Array.from({ length: 24 }, (_, hour) => snap[String(day)]?.[hour] ?? 0),
    );
  }

  return jsonOk({ accounts, top_posts, heatmap });
}
