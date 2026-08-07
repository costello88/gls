import { z } from "zod";
import { requireUser, jsonError, jsonOk } from "@/lib/api";
import { generateCampaignPlan } from "@/lib/ai/campaign";
import type { Campaign } from "@/lib/types";

export const maxDuration = 120;

/** GET /api/campaigns — the user's campaigns, newest first. */
export async function GET() {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { data, error: dbError } = await supa
    .from("campaigns")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ campaigns: (data ?? []) as Campaign[] });
}

const Body = z.object({
  name: z.string().min(1),
  goal: z.string().min(1),
  brief: z.string().min(1),
  start_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  days: z.number().int().min(1).max(31).default(7),
  account_ids: z.array(z.string().uuid()).min(1),
});

/** POST /api/campaigns — generate a day-by-day plan and store the campaign as "planned". */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const body = parsed.data;

  const plan = await generateCampaignPlan({
    name: body.name,
    goal: body.goal,
    brief: body.brief,
    startDate: body.start_date,
    days: body.days,
  });

  const { data: campaign, error: insertError } = await supa
    .from("campaigns")
    .insert({
      user_id: user.id,
      name: body.name,
      goal: body.goal,
      brief: body.brief,
      start_date: body.start_date,
      days: body.days,
      account_ids: body.account_ids,
      status: "planned",
      plan,
    })
    .select()
    .single<Campaign>();
  if (insertError || !campaign) {
    return jsonError(insertError?.message ?? "Could not create the campaign", 500);
  }

  return jsonOk({ campaign });
}
