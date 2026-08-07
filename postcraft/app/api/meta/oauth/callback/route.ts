import { NextResponse, type NextRequest } from "next/server";
import { requireUser } from "@/lib/api";
import { encryptToken } from "@/lib/crypto";
import { exchangeCode, getProfile, toLongLived } from "@/lib/meta/oauth";

/** Instagram OAuth redirect target: verify state, exchange code, store the account. */
export async function GET(request: NextRequest) {
  const base = process.env.NEXT_PUBLIC_APP_URL || new URL(request.url).origin;
  const redirect = (path: string) => {
    const res = NextResponse.redirect(new URL(path, base));
    res.cookies.delete("ig_oauth_state");
    return res;
  };
  const toError = (msg: string) => redirect(`/accounts?error=${encodeURIComponent(msg)}`);

  const { user, supa, error } = await requireUser();
  if (error) return redirect("/login");

  const { searchParams } = new URL(request.url);
  const denied = searchParams.get("error_description") ?? searchParams.get("error_reason") ?? searchParams.get("error");
  if (denied) return toError(denied);

  const code = searchParams.get("code");
  const state = searchParams.get("state");
  const cookieState = request.cookies.get("ig_oauth_state")?.value;
  if (!code) return toError("Missing authorization code");
  if (!state || !cookieState || state !== cookieState) {
    return toError("OAuth state mismatch — please try connecting again");
  }

  try {
    const short = await exchangeCode(code);
    const long = await toLongLived(short.access_token);
    const profile = await getProfile(long.access_token);

    const now = new Date();
    const { error: dbError } = await supa.from("ig_accounts").upsert(
      {
        user_id: user.id,
        ig_user_id: String(profile.user_id ?? short.user_id),
        username: profile.username,
        name: profile.name ?? null,
        profile_picture_url: profile.profile_picture_url ?? null,
        followers_count: profile.followers_count ?? 0,
        media_count: profile.media_count ?? 0,
        access_token_enc: encryptToken(long.access_token),
        token_expires_at: new Date(now.getTime() + long.expires_in * 1000).toISOString(),
        status: "active",
        connected_at: now.toISOString(),
        last_synced_at: now.toISOString(),
      },
      { onConflict: "user_id,ig_user_id" },
    );
    if (dbError) throw new Error(dbError.message);

    return redirect(`/accounts?connected=${encodeURIComponent(profile.username)}`);
  } catch (err) {
    return toError(err instanceof Error ? err.message : "Instagram connection failed");
  }
}
