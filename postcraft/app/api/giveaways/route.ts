import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Giveaway } from "@/lib/types";

/** GET /api/giveaways — the user's giveaways with entry/eligible counts, newest first. */
export async function GET() {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { data: giveaways, error: dbError } = await supa
    .from("giveaways")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (dbError) return jsonError(dbError.message, 500);

  const list = (giveaways ?? []) as Giveaway[];
  const counts = new Map<string, { entry_count: number; eligible_count: number }>();

  if (list.length > 0) {
    const { data: entries } = await supa
      .from("giveaway_entries")
      .select("giveaway_id, eligible")
      .in(
        "giveaway_id",
        list.map((g) => g.id),
      );
    for (const row of (entries ?? []) as Array<{ giveaway_id: string; eligible: boolean }>) {
      const c = counts.get(row.giveaway_id) ?? { entry_count: 0, eligible_count: 0 };
      c.entry_count++;
      if (row.eligible) c.eligible_count++;
      counts.set(row.giveaway_id, c);
    }
  }

  return jsonOk({
    giveaways: list.map((g) => ({
      ...g,
      ...(counts.get(g.id) ?? { entry_count: 0, eligible_count: 0 }),
    })),
  });
}

const RequirementsSchema = z.object({
  must_follow: z.boolean(),
  must_like: z.boolean(),
  mention_count: z.number().int().min(0),
  keyword: z.string().nullable(),
  hashtag: z.string().nullable(),
});

const Body = z.object({
  account_id: z.string().uuid(),
  post_id: z.string().uuid().nullable().optional(),
  ig_media_id: z.string().nullable().optional(),
  title: z.string().min(1),
  prize: z.string().min(1),
  ends_at: z.string().min(1),
  winner_count: z.number().int().min(1),
  requirements: RequirementsSchema,
});

/** POST /api/giveaways — create a live giveaway (ig_media_id resolved from the post when given). */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const body = parsed.data;

  let igMediaId = body.ig_media_id ?? null;
  if (body.post_id) {
    const { data: post } = await supa
      .from("posts")
      .select("ig_media_id")
      .eq("id", body.post_id)
      .eq("user_id", user.id)
      .single<{ ig_media_id: string | null }>();
    if (!post) return jsonError("Post not found", 404);
    if (post.ig_media_id) igMediaId = post.ig_media_id;
  }

  const { data: giveaway, error: insertError } = await supa
    .from("giveaways")
    .insert({
      user_id: user.id,
      account_id: body.account_id,
      post_id: body.post_id ?? null,
      ig_media_id: igMediaId,
      title: body.title,
      prize: body.prize,
      starts_at: new Date().toISOString(),
      ends_at: body.ends_at,
      winner_count: body.winner_count,
      requirements: body.requirements,
      status: "live",
    })
    .select()
    .single<Giveaway>();
  if (insertError || !giveaway) {
    return jsonError(insertError?.message ?? "Could not create the giveaway", 500);
  }

  return jsonOk({ giveaway });
}
