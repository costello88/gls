import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { advancePost } from "@/lib/publish/engine";
import type { Post } from "@/lib/types";

export const maxDuration = 300;

/** GET /api/posts?status=&from=&to= — the user's posts, newest first. from/to filter scheduled_at. */
export async function GET(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  let query = supa.from("posts").select("*").eq("user_id", user.id);
  if (status) query = query.eq("status", status);
  if (from) query = query.gte("scheduled_at", from);
  if (to) query = query.lte("scheduled_at", to);

  const { data, error: dbError } = await query
    .order("scheduled_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false });
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ posts: (data ?? []) as Post[] });
}

const Body = z.object({
  account_ids: z.array(z.string().uuid()).min(1),
  surfaces: z.array(z.enum(["feed", "reel", "story", "carousel"])).min(1),
  caption: z.string(),
  hashtags: z.array(z.string()),
  first_comment: z.string().nullable().optional(),
  media_urls: z.array(z.string()),
  design_ids: z.array(z.string().uuid()).optional(),
  scheduled_at: z.string().nullable().optional(),
  campaign_id: z.string().uuid().nullable().optional(),
  publish_now: z.boolean().optional(),
});

/** POST /api/posts — creates one post per account × surface; publishes immediately when publish_now. */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const body = parsed.data;

  const scheduledAt =
    body.scheduled_at ?? (body.publish_now ? new Date().toISOString() : null);

  const rows = body.account_ids.flatMap((accountId) =>
    body.surfaces.map((surface) => ({
      user_id: user.id,
      account_id: accountId,
      campaign_id: body.campaign_id ?? null,
      surface,
      caption: body.caption,
      hashtags: body.hashtags,
      first_comment: body.first_comment ?? null,
      media_urls: body.media_urls,
      design_ids: body.design_ids ?? [],
      status: "scheduled" as const,
      scheduled_at: scheduledAt,
    })),
  );

  const { data: created, error: insertError } = await supa
    .from("posts")
    .insert(rows)
    .select();
  if (insertError || !created) {
    return jsonError(insertError?.message ?? "Could not create the posts", 500);
  }

  let posts = created as Post[];

  if (body.publish_now) {
    for (const post of posts) {
      await advancePost(post, supa);
    }
    const { data: refreshed } = await supa
      .from("posts")
      .select("*")
      .in(
        "id",
        posts.map((p) => p.id),
      );
    if (refreshed) posts = refreshed as Post[];
  }

  return jsonOk({ posts });
}
