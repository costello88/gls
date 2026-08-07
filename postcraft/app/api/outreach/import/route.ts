import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { parseTargets } from "@/lib/outreach/parse";

const Body = z.object({
  text: z.string().min(1),
});

/** POST /api/outreach/import — parse pasted text into queued outreach targets. */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");

  const usernames = parseTargets(parsed.data.text);

  let added = 0;
  if (usernames.length > 0) {
    const { data: inserted, error: insertError } = await supa
      .from("outreach_targets")
      .upsert(
        usernames.map((username) => ({
          user_id: user.id,
          username,
          source_url: null,
          status: "queued" as const,
        })),
        { onConflict: "user_id,username", ignoreDuplicates: true },
      )
      .select();
    if (insertError) return jsonError(insertError.message, 500);
    added = inserted?.length ?? 0;
  }

  const { count } = await supa
    .from("outreach_targets")
    .select("*", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("status", "queued");

  return jsonOk({
    added,
    duplicates: usernames.length - added,
    total_queued: count ?? 0,
  });
}
