import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { drawWinners, newDrawSeed } from "@/lib/giveaways/draw";
import type { Giveaway, GiveawayEntry, GiveawayWinner } from "@/lib/types";

/**
 * POST /api/giveaways/[id]/draw — deterministic winner draw over eligible
 * entries. Reuses the stored seed on redraw so the result is reproducible.
 */
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

  if (giveaway.status === "live") {
    await supa.from("giveaways").update({ status: "closed" }).eq("id", id).eq("user_id", user.id);
  }

  const seed = giveaway.draw_seed ?? newDrawSeed();

  const { data: entries, error: entriesError } = await supa
    .from("giveaway_entries")
    .select("*")
    .eq("giveaway_id", id)
    .eq("eligible", true);
  if (entriesError) return jsonError(entriesError.message, 500);

  const eligible = (entries ?? []) as GiveawayEntry[];
  if (eligible.length === 0) return jsonError("No eligible entries to draw from");

  const drawn = drawWinners(
    eligible.map((e) => ({ id: e.id, username: e.username })),
    giveaway.winner_count,
    seed,
  );

  const now = new Date().toISOString();

  const { error: deleteError } = await supa
    .from("giveaway_winners")
    .delete()
    .eq("giveaway_id", id);
  if (deleteError) return jsonError(deleteError.message, 500);

  const { data: winners, error: insertError } = await supa
    .from("giveaway_winners")
    .insert(
      drawn.map((candidate, i) => ({
        giveaway_id: id,
        user_id: user.id,
        entry_id: candidate.id,
        username: candidate.username,
        draw_index: i,
        drawn_at: now,
        disqualified: false,
      })),
    )
    .select();
  if (insertError || !winners) {
    return jsonError(insertError?.message ?? "Could not record the winners", 500);
  }

  const { error: updateError } = await supa
    .from("giveaways")
    .update({ status: "drawn", draw_seed: seed, drawn_at: now })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) return jsonError(updateError.message, 500);

  return jsonOk({ winners: winners as GiveawayWinner[], seed });
}
