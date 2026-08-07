import { NextResponse } from "next/server";
import { requireUser, jsonError } from "@/lib/api";
import type { Giveaway, GiveawayEntry } from "@/lib/types";

function csvField(value: string | number | boolean | null): string {
  const s = value === null ? "" : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** GET /api/giveaways/[id]/export — entries as a CSV download. */
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

  const { data: entries, error: dbError } = await supa
    .from("giveaway_entries")
    .select("*")
    .eq("giveaway_id", id)
    .order("commented_at", { ascending: true, nullsFirst: false });
  if (dbError) return jsonError(dbError.message, 500);

  const lines = [
    "username,text,eligible,mention_count,commented_at",
    ...((entries ?? []) as GiveawayEntry[]).map((e) =>
      [
        csvField(e.username),
        csvField(e.text),
        csvField(e.eligible),
        csvField(e.mention_count),
        csvField(e.commented_at),
      ].join(","),
    ),
  ];

  return new NextResponse(lines.join("\n") + "\n", {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="giveaway-${giveaway.id}-entries.csv"`,
    },
  });
}
