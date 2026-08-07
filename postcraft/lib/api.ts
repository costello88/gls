import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Auth guard for route handlers. Returns the user-scoped client (RLS active). */
export async function requireUser(): Promise<
  { user: User; supa: SupabaseClient; error: null } | { user: null; supa: null; error: NextResponse }
> {
  const supa = await createClient();
  const {
    data: { user },
  } = await supa.auth.getUser();
  if (!user) {
    return { user: null, supa: null, error: NextResponse.json({ error: "Not signed in" }, { status: 401 }) };
  }
  return { user, supa, error: null };
}

export function jsonError(message: string, status = 400): NextResponse {
  return NextResponse.json({ error: message }, { status });
}

export function jsonOk<T>(data: T, status = 200): NextResponse {
  return NextResponse.json(data as object, { status });
}

/** Upload a buffer to the public media bucket; returns { path, publicUrl }. */
export async function uploadToMedia(
  supa: SupabaseClient,
  userId: string,
  buffer: Buffer,
  ext: "jpg" | "png" | "mp4",
  prefix: string,
): Promise<{ path: string; publicUrl: string }> {
  const contentType = ext === "mp4" ? "video/mp4" : ext === "png" ? "image/png" : "image/jpeg";
  const path = `${userId}/${prefix}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
  const { error } = await supa.storage.from("media").upload(path, buffer, { contentType });
  if (error) throw new Error(`Storage upload failed: ${error.message}`);
  const {
    data: { publicUrl },
  } = supa.storage.from("media").getPublicUrl(path);
  return { path, publicUrl };
}
