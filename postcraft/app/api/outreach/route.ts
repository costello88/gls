import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { OutreachSettings, OutreachTarget } from "@/lib/types";

const STATUSES = ["queued", "followed", "skipped", "followed_back", "unfollowed"] as const;

/** GET /api/outreach?status=&limit= — targets plus pace stats. */
export async function GET(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const limitRaw = Number(searchParams.get("limit"));
  const limit = Number.isFinite(limitRaw) && limitRaw > 0 ? Math.min(limitRaw, 500) : 200;

  if (status && !STATUSES.includes(status as (typeof STATUSES)[number])) {
    return jsonError("Unknown status filter");
  }

  let query = supa.from("outreach_targets").select("*").eq("user_id", user.id);
  if (status) query = query.eq("status", status);

  const { data: targets, error: dbError } = await query
    .order("created_at", { ascending: false })
    .limit(limit);
  if (dbError) return jsonError(dbError.message, 500);

  const countByStatus = async (s: string): Promise<number> => {
    const { count } = await supa
      .from("outreach_targets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .eq("status", s);
    return count ?? 0;
  };

  const todayStart = new Date();
  todayStart.setHours(0, 0, 0, 0);

  const [queued, followed, followedBack, skipped, todayFollowed, settingsRes] = await Promise.all([
    countByStatus("queued"),
    countByStatus("followed"),
    countByStatus("followed_back"),
    countByStatus("skipped"),
    supa
      .from("outreach_targets")
      .select("*", { count: "exact", head: true })
      .eq("user_id", user.id)
      .gte("followed_at", todayStart.toISOString())
      .then(({ count }) => count ?? 0),
    supa
      .from("outreach_settings")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle<OutreachSettings>(),
  ]);

  return jsonOk({
    targets: (targets ?? []) as OutreachTarget[],
    stats: {
      queued,
      followed,
      followed_back: followedBack,
      skipped,
      today_followed: todayFollowed,
      daily_target: settingsRes.data?.daily_target ?? 30,
    },
  });
}
