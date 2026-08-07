import { requireUser, jsonError, jsonOk } from "@/lib/api";
import type { Campaign, Post } from "@/lib/types";

/**
 * POST /api/campaigns/[id]/materialize — turn the plan into draft posts
 * (one per plan day × account). Drafts because media isn't attached yet;
 * the calendar/create flow attaches designs.
 */
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { user, supa, error } = await requireUser();
  if (error) return error;
  const { id } = await params;

  const { data: campaign } = await supa
    .from("campaigns")
    .select("*")
    .eq("id", id)
    .eq("user_id", user.id)
    .single<Campaign>();
  if (!campaign) return jsonError("Campaign not found", 404);

  if (!campaign.plan || campaign.plan.length === 0) {
    return jsonError("Campaign has no plan to materialize");
  }
  if (!campaign.account_ids || campaign.account_ids.length === 0) {
    return jsonError("Campaign has no accounts assigned");
  }

  const rows = campaign.plan.flatMap((day) =>
    campaign.account_ids.map((accountId) => ({
      user_id: user.id,
      account_id: accountId,
      campaign_id: campaign.id,
      surface: day.surface,
      caption: day.caption_draft,
      hashtags: day.hashtags,
      first_comment: null,
      media_urls: [] as string[],
      design_ids: [] as string[],
      status: "draft" as const,
      scheduled_at: `${day.date}T${day.best_time}:00`,
    })),
  );

  const { data: posts, error: insertError } = await supa
    .from("posts")
    .insert(rows)
    .select();
  if (insertError || !posts) {
    return jsonError(insertError?.message ?? "Could not create the draft posts", 500);
  }

  const { error: updateError } = await supa
    .from("campaigns")
    .update({ status: "materialized" })
    .eq("id", id)
    .eq("user_id", user.id);
  if (updateError) return jsonError(updateError.message, 500);

  return jsonOk({ posts: posts as Post[] });
}
