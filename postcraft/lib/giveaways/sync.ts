import type { SupabaseClient } from "@supabase/supabase-js";
import { decryptToken } from "@/lib/crypto";
import { checkEntry } from "@/lib/giveaways/verify";
import { mediaComments } from "@/lib/meta/insights";
import type { Giveaway, IgAccount } from "@/lib/types";

const MAX_PAGES = 40;

/**
 * Pull comments for the giveaway's Instagram media, verify each against the
 * requirements, and upsert them as entries. Shared by the manual sync route
 * and the cron sweep. Returns { imported: rows upserted, total: comments seen }.
 */
export async function syncGiveawayEntries(
  giveaway: Giveaway,
  supa: SupabaseClient,
): Promise<{ imported: number; total: number }> {
  const mediaId = giveaway.ig_media_id;
  if (!mediaId) throw new Error("Giveaway has no Instagram media attached yet");

  const { data: account } = await supa
    .from("ig_accounts")
    .select("*")
    .eq("id", giveaway.account_id)
    .single<IgAccount>();
  if (!account) throw new Error("Giveaway account not found");

  const token = decryptToken(account.access_token_enc);

  let imported = 0;
  let total = 0;
  let after: string | undefined;

  for (let page = 0; page < MAX_PAGES; page++) {
    const { comments, next } = await mediaComments(mediaId, token, after);
    for (const comment of comments) {
      total++;
      const username = comment.username ?? comment.from?.username;
      if (!username) continue;

      const text = comment.text ?? "";
      const check = checkEntry(text, giveaway.requirements);
      const { error } = await supa.from("giveaway_entries").upsert(
        {
          giveaway_id: giveaway.id,
          user_id: giveaway.user_id,
          ig_comment_id: comment.id,
          username,
          text,
          mention_count: check.mentionCount,
          checks: {
            hasKeyword: check.hasKeyword,
            hasHashtag: check.hasHashtag,
            mentionOk: check.mentionOk,
          },
          eligible: check.eligible,
          commented_at: comment.timestamp ?? null,
        },
        { onConflict: "giveaway_id,ig_comment_id" },
      );
      if (!error) imported++;
    }
    if (!next) break;
    after = next;
  }

  await supa
    .from("giveaways")
    .update({ entries_synced_at: new Date().toISOString() })
    .eq("id", giveaway.id);

  return { imported, total };
}
