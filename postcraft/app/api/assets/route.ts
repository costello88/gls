import sharp from "sharp";
import { requireUser, jsonError, jsonOk, uploadToMedia } from "@/lib/api";
import type { Asset } from "@/lib/types";

export const maxDuration = 60;

/** GET /api/assets — the user's uploaded originals, newest first. */
export async function GET() {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const { data, error: dbError } = await supa
    .from("assets")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ assets: (data ?? []) as Asset[] });
}

/** POST /api/assets — multipart upload; images are normalized to JPEG (rotated, max 2160px long edge). */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const form = await request.formData().catch(() => null);
  if (!form) return jsonError("Expected multipart form data");

  const file = form.get("file");
  if (!(file instanceof File)) return jsonError("Missing \"file\" field");

  const original = Buffer.from(await file.arrayBuffer());
  if (original.length === 0) return jsonError("The uploaded file is empty");

  const isVideo = file.type.startsWith("video/") || /\.(mp4|mov|m4v)$/i.test(file.name);

  let buffer: Buffer = original;
  let ext: "jpg" | "mp4" = "jpg";
  let kind: Asset["kind"] = "image";
  let width: number | null = null;
  let height: number | null = null;

  if (isVideo) {
    ext = "mp4";
    kind = "video";
  } else {
    try {
      const { data, info } = await sharp(original)
        .rotate()
        .resize(2160, 2160, { fit: "inside", withoutEnlargement: true })
        .jpeg({ quality: 88, mozjpeg: true })
        .toBuffer({ resolveWithObject: true });
      buffer = data;
      width = info.width;
      height = info.height;
    } catch {
      return jsonError("Could not read that image — upload a JPEG, PNG, or WebP");
    }
  }

  let uploaded: { path: string; publicUrl: string };
  try {
    uploaded = await uploadToMedia(supa, user.id, buffer, ext, "assets");
  } catch (err) {
    return jsonError(err instanceof Error ? err.message : "Upload failed", 500);
  }

  const { data: asset, error: insertError } = await supa
    .from("assets")
    .insert({
      user_id: user.id,
      storage_path: uploaded.path,
      public_url: uploaded.publicUrl,
      kind,
      width,
      height,
      original_name: file.name || null,
    })
    .select()
    .single<Asset>();
  if (insertError || !asset) return jsonError(insertError?.message ?? "Could not save the asset", 500);

  return jsonOk({ asset });
}
