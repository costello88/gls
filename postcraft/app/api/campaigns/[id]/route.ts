import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Campaign, Post } from "@/lib/types";

/** GET /api/campaigns/[id] — the campaign plus its posts. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { data: campaign } = await supa
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Campaign>();
  if (!campaign) return jsonError("Campaign not found", 404);

  const { data: posts, error: postsError } = await supa
    .from("posts")
    .select("*")
    .eq("campaign_id", id)
    .eq("user_id", user.id)
    .order("scheduled_at", { ascending: true, nullsFirst: false });
  if (postsError) return jsonError(postsError.message, 500);

  return jsonOk({ campaign, posts: (posts ?? []) as Post[] });
}

const CampaignDaySchema = z.object({
  day: z.number().int().min(1),
  date: z.string(),
  theme: z.string(),
  surface: z.enum(["feed", "reel", "story", "carousel"]),
  design_direction: z.string(),
  caption_draft: z.string(),
  hashtags: z.array(z.string()),
  best_time: z.string().regex(/^\d{2}:\d{2}$/),
});

const Body = z.object({
  plan: z.array(CampaignDaySchema).optional(),
  status: z.enum(["draft", "planned", "materialized", "running", "done"]).optional(),
  name: z.string().min(1).optional(),
});

/** PATCH /api/campaigns/[id] — edit the plan, status, or name. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const body = parsed.data;

  const { data: existing } = await supa
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Campaign>();
  if (!existing) return jsonError("Campaign not found", 404);

  const update: Record<string, unknown> = {};
  if (body.plan !== undefined) update.plan = body.plan;
  if (body.status !== undefined) update.status = body.status;
  if (body.name !== undefined) update.name = body.name;

  if (Object.keys(update).length === 0) return jsonOk({ campaign: existing });

  const { data: campaign, error: dbError } = await supa
    .from("campaigns")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<Campaign>();
  if (dbError || !campaign) return jsonError(dbError?.message ?? "Update failed", 500);

  return jsonOk({ campaign });
}

/** DELETE /api/campaigns/[id] */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { error: dbError } = await supa
    .from("campaigns")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ ok: true });
}
