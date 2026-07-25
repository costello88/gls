import { NextResponse } from "next/server";
import { COOKIE_NAME, createSessionCookieValue } from "../../../../lib/session";

export async function POST(request: Request): Promise<Response> {
  const body = (await request.json()) as { password?: string };

  if (body.password !== process.env.DASHBOARD_PASSWORD) {
    return NextResponse.json({ error: "Ongeldig wachtwoord" }, { status: 401 });
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
  return response;
}
