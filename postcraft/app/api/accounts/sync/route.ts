import { jsonOk, requireUser } from "@/lib/api";
import { decryptToken } from "@/lib/crypto";
import { getProfile } from "@/lib/meta/oauth";
import type { IgAccount } from "@/lib/types";

export const maxDuration = 60;

/** Refresh profile stats (followers, media count, avatar) for every connected account. */
export async function POST() {
  const { supa, error } = await requireUser();
  if (error) return error;

  const { data } = await supa.from("ig_accounts").select("*");
  const accounts = (data ?? []) as IgAccount[];

  let synced = 0;
  for (const account of accounts) {
    try {
      const token = decryptToken(account.access_token_enc);
      const profile = await getProfile(token);
      const { error: dbError } = await supa
        .from("ig_accounts")
        .update({
          username: profile.username ?? account.username,
          name: profile.name ?? account.name,
          profile_picture_url: profile.profile_picture_url ?? account.profile_picture_url,
          followers_count: profile.followers_count ?? account.followers_count,
          media_count: profile.media_count ?? account.media_count,
          last_synced_at: new Date().toISOString(),
        })
        .eq("id", account.id);
      if (!dbError) synced++;
    } catch {
      // Sync is best-effort per account; a bad token shouldn't block the rest.
    }
  }

  return jsonOk({ synced });
}
