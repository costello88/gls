import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { syncGiveawayEntries } from "@/lib/giveaways/sync";
import type { Giveaway } from "@/lib/types";

export const maxDuration = 300;

/** POST /api/giveaways/[id]/sync — pull + verify comments as entries. */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { data: giveaway } = await supa
    .from("giveaways")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Giveaway>();
  if (!giveaway) return jsonError("Giveaway not found", 404);

  try {
    const { imported, total } = await syncGiveawayEntries(giveaway, supa);
    return jsonOk({ imported, total });
  } catch (e) {
    return jsonError(e instanceof Error ? e.message : "Entry sync failed", 400);
  }
}
