import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { accountReach, mediaInsights, onlineFollowers } from "@/lib/meta/insights";
import { getProfile } from "@/lib/meta/oauth";
import type { IgAccount, Post } from "@/lib/types";

/**
 * Capture an insights snapshot for the given accounts (followers, daily reach,
 * audience-online heatmap) plus fresh metrics for posts published in the last
 * 7 days. Shared by the daily cron sweep and the manual insights sync route.
 * Returns the number of snapshot/metric rows written.
 */
export async function snapshotInsights(accounts: IgAccount[], supa: SupabaseClient): Promise<number> {
  let written = 0;
  const tokens = new Map<string, string>();

  for (const account of accounts) {
    try {
      const token = decryptToken(account.access_token_enc);
      tokens.set(account.id, token);

      const [reach, online, profile] = await Promise.all([
        accountReach(account.ig_user_id, token),
        onlineFollowers(account.ig_user_id, token),
        getProfile(token).catch(() => null),
      ]);

      const { error } = await supa.from("account_insights").insert({
        user_id: account.user_id,
        account_id: account.id,
        followers_count: profile?.followers_count ?? account.followers_count,
        reach_day: reach,
        online_followers: online,
      });
      if (!error) written++;
    } catch {
      // Per-account snapshot is best-effort; keep going.
    }
  }

  const accountIds = [...tokens.keys()];
  if (!accountIds.length) return written;

  const since = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const { data } = await supa
    .from("posts")
    .select("*")
    .eq("status", "published")
    .gte("published_at", since)
    .in("account_id", accountIds)
    .not("ig_media_id", "is", null);

  for (const post of (data ?? []) as Post[]) {
    const token = tokens.get(post.account_id);
    if (!token || !post.ig_media_id) continue;
    try {
      const m = await mediaInsights(post.ig_media_id, token);
      if (!m) continue;
      const { error } = await supa.from("post_metrics").insert({
        user_id: post.user_id,
        post_id: post.id,
        likes: m.likes,
        comments: m.comments,
        saves: m.saved,
        shares: m.shares,
        reach: m.reach,
      });
      if (!error) written++;
    } catch {
      // Metrics are best-effort per post.
    }
  }

  return written;
}
