import type { NextRequest } from "next/server";
import { jsonError, jsonOk } from "@/lib/api";
import { decryptToken, encryptToken } from "@/lib/crypto";
import { syncGiveawayEntries } from "@/lib/giveaways/sync";
import { snapshotInsights } from "@/lib/insights/snapshot";
import { refreshLongLived } from "@/lib/meta/oauth";
import { advancePost } from "@/lib/publish/engine";
import { createServiceClient } from "@/lib/supabase/server";
import type { Giveaway, IgAccount, Post } from "@/lib/types";

export const maxDuration = 300;

/**
 * Minutely sweep (Vercel Cron). Each step runs in its own try/catch so one
 * failure never kills the rest of the sweep.
 */
export async function GET(request: NextRequest) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return jsonError("Unauthorized", 401);
  }

  const supa = createServiceClient();
  const now = new Date();

  let published = 0;
  let advanced = 0;
  let refreshed = 0;
  let closed = 0;
  let synced = 0;

  // 1. Due scheduled posts → advance the publish state machine.
  try {
    const { data } = await supa
      .from("posts")
      .select("*")
      .eq("status", "scheduled")
      .lte("scheduled_at", now.toISOString())
      .order("scheduled_at", { ascending: true })
      .limit(10);
    for (const post of (data ?? []) as Post[]) {
      try {
        await advancePost(post, supa);
        published++;
      } catch {
        // advancePost records its own failures; keep sweeping.
      }
    }
  } catch {
    // Step failed wholesale — move on.
  }

  // 2. Posts stuck in "publishing" (untouched for 30s) → advance again.
  try {
    const stale = new Date(now.getTime() - 30_000).toISOString();
    const { data } = await supa
      .from("posts")
      .select("*")
      .eq("status", "publishing")
      .lt("updated_at", stale)
      .order("updated_at", { ascending: true })
      .limit(10);
    for (const post of (data ?? []) as Post[]) {
      try {
        await advancePost(post, supa);
        advanced++;
      } catch {
        // Keep sweeping.
      }
    }
  } catch {
    // Move on.
  }

  // 3. Tokens expiring within 10 days → refresh (or mark expired).
  try {
    const soon = new Date(now.getTime() + 10 * 86_400_000).toISOString();
    const { data } = await supa
      .from("ig_accounts")
      .select("*")
      .not("token_expires_at", "is", null)
      .lt("token_expires_at", soon);
    for (const account of (data ?? []) as IgAccount[]) {
      try {
        const fresh = await refreshLongLived(decryptToken(account.access_token_enc));
        await supa
          .from("ig_accounts")
          .update({
            access_token_enc: encryptToken(fresh.access_token),
            token_expires_at: new Date(Date.now() + fresh.expires_in * 1000).toISOString(),
            status: "active",
          })
          .eq("id", account.id);
        refreshed++;
      } catch {
        await supa.from("ig_accounts").update({ status: "token_expired" }).eq("id", account.id);
      }
    }
  } catch {
    // Move on.
  }

  // 4. Live giveaways past their end date → close.
  try {
    const { data } = await supa
      .from("giveaways")
      .update({ status: "closed" })
      .eq("status", "live")
      .lt("ends_at", now.toISOString())
      .select("id");
    closed = data?.length ?? 0;
  } catch {
    // Move on.
  }

  // 5. Every 30 minutes: sync entries for live giveaways.
  try {
    if (now.getUTCMinutes() % 30 === 0) {
      const { data } = await supa.from("giveaways").select("*").eq("status", "live");
      for (const giveaway of (data ?? []) as Giveaway[]) {
        try {
          await syncGiveawayEntries(giveaway, supa);
          synced++;
        } catch {
          // A single giveaway failing shouldn't block the rest.
        }
      }
    }
  } catch {
    // Move on.
  }

  // 6. Daily at 03:00 UTC: insights snapshot for all accounts + recent post metrics.
  try {
    if (now.getUTCHours() === 3 && now.getUTCMinutes() < 1) {
      const { data } = await supa.from("ig_accounts").select("*");
      await snapshotInsights((data ?? []) as IgAccount[], supa);
    }
  } catch {
    // Move on.
  }

  return jsonOk({ published, advanced, refreshed, closed, synced });
}
