import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { OutreachSettings } from "@/lib/types";

const DEFAULTS = { daily_target: 30, active_start_hour: 9, active_end_hour: 21 };

/** GET /api/outreach/settings — the user's settings, creating the default row if missing. */
export async function GET() {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { data: existing } = await supa
    .from("outreach_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<OutreachSettings>();
  if (existing) return jsonOk({ settings: existing });

  const { data: created, error: insertError } = await supa
    .from("outreach_settings")
    .upsert({ user_id: user.id, ...DEFAULTS }, { onConflict: "user_id" })
    .select()
    .single<OutreachSettings>();
  if (insertError || !created) {
    return jsonError(insertError?.message ?? "Could not create settings", 500);
  }

  return jsonOk({ settings: created });
}

const Body = z.object({
  daily_target: z.number().int().min(0).max(1000).optional(),
  active_start_hour: z.number().int().min(0).max(23).optional(),
  active_end_hour: z.number().int().min(0).max(23).optional(),
});

/** PATCH /api/outreach/settings — upsert pace target and active hours. */
export async function PATCH(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");

  const { data: existing } = await supa
    .from("outreach_settings")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle<OutreachSettings>();

  const merged = { ...DEFAULTS, ...(existing ?? {}), ...parsed.data, user_id: user.id };

  const { data: settings, error: dbError } = await supa
    .from("outreach_settings")
    .upsert(merged, { onConflict: "user_id" })
    .select()
    .single<OutreachSettings>();
  if (dbError || !settings) return jsonError(dbError?.message ?? "Update failed", 500);

  return jsonOk({ settings });
}
