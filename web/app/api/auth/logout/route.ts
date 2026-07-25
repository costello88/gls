import { NextResponse } from "next/server";
import { COOKIE_NAME } from "../../../../lib/session";

export async function POST(): Promise<Response> {
  const response = NextResponse.json({ ok: true });
  response.cookies.set(COOKIE_NAME, "", { path: "/", maxAge: 0 });
  return response;
}
