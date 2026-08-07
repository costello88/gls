import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Giveaway, GiveawayEntry, GiveawayWinner } from "@/lib/types";

/** GET /api/giveaways/[id] — one giveaway with its entries and winners. */
export async function GET(
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

  const [{ data: entries }, { data: winners }] = await Promise.all([
    supa
      .from("giveaway_entries")
      .select("*")
      .eq("giveaway_id", id)
      .order("commented_at", { ascending: true, nullsFirst: false }),
    supa
      .from("giveaway_winners")
      .select("*")
      .eq("giveaway_id", id)
      .order("draw_index", { ascending: true }),
  ]);

  return jsonOk({
    giveaway,
    entries: (entries ?? []) as GiveawayEntry[],
    winners: (winners ?? []) as GiveawayWinner[],
  });
}
