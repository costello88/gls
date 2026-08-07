import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Design } from "@/lib/types";

/** GET /api/designs?format= — the user's generated designs, newest first. */
export async function GET(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { searchParams } = new URL(request.url);
  const format = searchParams.get("format");

  let query = supa.from("designs").select("*").eq("user_id", user.id);
  if (format === "feed" || format === "story") query = query.eq("format", format);

  const { data, error: dbError } = await query.order("created_at", { ascending: false });
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ designs: (data ?? []) as Design[] });
}
