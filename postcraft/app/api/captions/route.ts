import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { generateCaptions } from "@/lib/ai/captions";

export const maxDuration = 60;

const Body = z.object({
  brief: z.string().min(1).max(2000),
  tone: z.enum(["confident", "playful", "minimal", "storyteller", "salesy"]).optional(),
  n: z.number().int().min(1).max(6).optional(),
  surface: z.enum(["feed", "reel", "story", "carousel"]).optional(),
});

/** POST /api/captions — generate caption alternatives for a brief. */
export async function POST(request: Request) {
  const { error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const { brief, tone, n, surface } = parsed.data;

  const captions = await generateCaptions(brief, tone ?? "confident", n ?? 3, surface ?? "feed");
  return jsonOk({ captions });
}
