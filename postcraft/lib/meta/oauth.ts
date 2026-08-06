/**
 * Business Login for Instagram (Instagram API with Instagram Login).
 * Flow: instagram.com/oauth/authorize → api.instagram.com/oauth/access_token
 * (short-lived, 1h) → graph.instagram.com ig_exchange_token (long-lived, ~60d)
 * → refresh with ig_refresh_token before expiry.
 */

import { graph } from "./client";

export const IG_SCOPES = [
  "instagram_business_basic",
  "instagram_business_content_publish",
  "instagram_business_manage_comments",
  "instagram_business_manage_insights",
].join(",");

export function getLoginUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: process.env.META_APP_ID!,
    redirect_uri: redirectUri(),
    response_type: "code",
    scope: IG_SCOPES,
    state,
    enable_fb_login: "0",
    force_authentication: "1",
  });
  return `https://www.instagram.com/oauth/authorize?${params}`;
}

export function redirectUri(): string {
  return `${process.env.NEXT_PUBLIC_APP_URL}/api/meta/oauth/callback`;
}

export interface ShortLivedToken {
  access_token: string;
  user_id: string;
  permissions?: string[];
}

export async function exchangeCode(code: string): Promise<ShortLivedToken> {
  const res = await fetch("https://api.instagram.com/oauth/access_token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.META_APP_ID!,
      client_secret: process.env.META_APP_SECRET!,
      grant_type: "authorization_code",
      redirect_uri: redirectUri(),
      code,
    }),
  });
  const body = (await res.json()) as ShortLivedToken & { error_message?: string };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error_message ?? "Instagram code exchange failed");
  }
  return body;
}

export interface LongLivedToken {
  access_token: string;
  expires_in: number; // seconds (~60 days)
}

export async function toLongLived(shortToken: string): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: "ig_exchange_token",
    client_secret: process.env.META_APP_SECRET!,
    access_token: shortToken,
  });
  const res = await fetch(`https://graph.instagram.com/access_token?${params}`);
  const body = (await res.json()) as LongLivedToken & { error?: { message: string } };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error?.message ?? "Long-lived token exchange failed");
  }
  return body;
}

export async function refreshLongLived(longToken: string): Promise<LongLivedToken> {
  const params = new URLSearchParams({
    grant_type: "ig_refresh_token",
    access_token: longToken,
  });
  const res = await fetch(`https://graph.instagram.com/refresh_access_token?${params}`);
  const body = (await res.json()) as LongLivedToken & { error?: { message: string } };
  if (!res.ok || !body.access_token) {
    throw new Error(body.error?.message ?? "Token refresh failed");
  }
  return body;
}

export interface IgProfile {
  user_id: string;
  username: string;
  name?: string;
  profile_picture_url?: string;
  followers_count?: number;
  media_count?: number;
  account_type?: string;
}

/** Profile of the token's owner (the connected professional account). */
export async function getProfile(accessToken: string): Promise<IgProfile> {
  return graph<IgProfile>("/me", accessToken, {
    params: {
      fields: "user_id,username,name,profile_picture_url,followers_count,media_count,account_type",
    },
  });
}
