import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Design } from "@/lib/types";

const Body = z.object({
  selected: z.boolean().optional(),
});

/** PATCH /api/designs/[id] — toggle selection. */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");

  const update: Record<string, unknown> = {};
  if (parsed.data.selected !== undefined) update.selected = parsed.data.selected;

  if (Object.keys(update).length === 0) {
    const { data: design } = await supa
      .from("designs")
      .select("*")
      .eq("id", id)
      .eq("user_id", user.id)
      .single<Design>();
    if (!design) return jsonError("Design not found", 404);
    return jsonOk({ design });
  }

  const { data: design, error: dbError } = await supa
    .from("designs")
    .update(update)
    .eq("id", id)
    .eq("user_id", user.id)
    .select()
    .single<Design>();
  if (dbError || !design) return jsonError("Design not found", 404);

  return jsonOk({ design });
}
