import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Post } from "@/lib/types";

const Body = z.object({
  caption: z.string().optional(),
  hashtags: z.array(z.string()).optional(),
  first_comment: z.string().nullable().optional(),
  scheduled_at: z.string().nullable().optional(),
  status: z.enum(["draft", "scheduled"]).optional(),
});

/**
 * PATCH /api/posts/[id] — partial edit. Allowed status moves:
 * draft→scheduled, scheduled→draft, failed→scheduled (retry resets attempts + error).
 */
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

  const { data: post } = await supa
    .from("posts")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Post>();
  if (!post) return jsonError("Post not found", 404);

  const update: Record<string, unknown> = {};
  if (body.caption !== undefined) update.caption = body.caption;
  if (body.hashtags !== undefined) update.hashtags = body.hashtags;
  if (body.first_comment !== undefined) update.first_comment = body.first_comment;
  if (body.scheduled_at !== undefined) update.scheduled_at = body.scheduled_at;

  if (body.status !== undefined && body.status !== post.status) {
    const allowed =
      (post.status === "draft" && body.status === "scheduled") ||
      (post.status === "scheduled" && body.status === "draft") ||
      (post.status === "failed" && body.status === "scheduled");
    if (!allowed) {
      return jsonError(`Cannot move a ${post.status} post to ${body.status}`);
    }
    update.status = body.status;
    if (post.status === "failed") {
      update.publish_attempts = 0;
      update.error = null;
    }
  }

  if (Object.keys(update).length === 0) return jsonOk({ post });

  const { data: updated, error: dbError } = await supa
    .from("posts")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<Post>();
  if (dbError || !updated) return jsonError(dbError?.message ?? "Update failed", 500);

  return jsonOk({ post: updated });
}

/** DELETE /api/posts/[id] */
export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { error: dbError } = await supa
    .from("posts")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ ok: true });
}
