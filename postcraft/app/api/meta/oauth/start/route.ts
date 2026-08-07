import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { requireUser } from "@/lib/api";
import { getLoginUrl } from "@/lib/meta/oauth";

/** Kick off Instagram Business Login: stash a CSRF state cookie, redirect to Instagram. */
export async function GET() {
  const { error } = await requireUser();
  if (error) return error;

  const state = randomBytes(16).toString("hex");
  const res = NextResponse.redirect(getLoginUrl(state));
  res.cookies.set("ig_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return res;
}
