import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { decryptToken } from "@/lib/crypto";
import { businessDiscovery } from "@/lib/meta/insights";
import type { IgAccount, OutreachTarget } from "@/lib/types";

export const maxDuration = 120;

const Body = z.object({
  ids: z.array(z.string().uuid()).min(1).max(20),
});

/** POST /api/outreach/enrich — Business Discovery lookups for up to 20 targets. */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");

  const { data: account } = await supa
    .from("ig_accounts")
    .select("*")
    .eq("user_id", user.id)
    .eq("status", "active")
    .order("connected_at", { ascending: true })
    .limit(1)
    .maybeSingle<IgAccount>();
  if (!account) return jsonError("Connect an active Instagram account first");

  const token = decryptToken(account.access_token_enc);

  const { data: targets, error: dbError } = await supa
    .from("outreach_targets")
    .select("*")
    .eq("user_id", user.id)
    .in("id", parsed.data.ids);
  if (dbError) return jsonError(dbError.message, 500);

  let enriched = 0;
  for (const target of (targets ?? []) as OutreachTarget[]) {
    const profile = await businessDiscovery(account.ig_user_id, token, target.username);
    if (!profile) continue;

    const { error: updateError } = await supa
      .from("outreach_targets")
      .update({
        followers_count: profile.followers_count ?? null,
        media_count: profile.media_count ?? null,
        full_name: profile.name ?? null,
        biography: profile.biography ?? null,
      })
      .eq("id", target.id)
      .eq("user_id", user.id);
    if (!updateError) enriched++;
  }

  return jsonOk({ enriched });
}
