import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { OutreachTarget } from "@/lib/types";

const Body = z.object({
  status: z.enum(["queued", "followed", "skipped", "followed_back", "unfollowed"]).optional(),
  notes: z.string().nullable().optional(),
  assigned_account_id: z.string().uuid().nullable().optional(),
});

/** PATCH /api/outreach/[id] — update a target; moving to "followed" stamps followed_at. */
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
    .from("outreach_targets")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<OutreachTarget>();
  if (!existing) return jsonError("Target not found", 404);

  const update: Record<string, unknown> = {};
  if (body.status !== undefined) {
    update.status = body.status;
    if (body.status === "followed") update.followed_at = new Date().toISOString();
  }
  if (body.notes !== undefined) update.notes = body.notes;
  if (body.assigned_account_id !== undefined) update.assigned_account_id = body.assigned_account_id;

  if (Object.keys(update).length === 0) return jsonOk({ target: existing });

  const { data: target, error: dbError } = await supa
    .from("outreach_targets")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<OutreachTarget>();
  if (dbError || !target) return jsonError(dbError?.message ?? "Update failed", 500);

  return jsonOk({ target });
}
