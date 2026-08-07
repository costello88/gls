import { z } from "zod";
import { requireUser, jsonError, jsonOk, uploadToMedia } from "@/lib/api";
import { generateDesigns } from "@/lib/design/index";
import { SURFACE_DIMENSIONS, type Asset, type Design } from "@/lib/types";

export const maxDuration = 300;

const Body = z.object({
  asset_id: z.string().uuid(),
  headline: z.string().min(1).max(200),
  sub: z.string().max(300).optional(),
  brief: z.string().max(2000).optional(),
  format: z.enum(["feed", "story"]),
  username: z.string().max(60).optional(),
});

/** POST /api/designs/generate — one asset + text → many Instagram-ready design variants. */
export async function POST(request: Request) {
  const { user, supa, error } = await requireUser();
  if (error) return error;

  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Invalid request body");
  const { asset_id, headline, sub, brief, format, username } = parsed.data;

  const { data: asset } = await supa
    .from("assets")
    .select("*")
    .eq("id", asset_id)
    .eq("user_id", user.id)
    .single<Asset>();
  if (!asset) return jsonError("Asset not found", 404);
  if (asset.kind !== "image") return jsonError("Designs can only be generated from an image asset");

  const { data: fileData, error: dlError } = await supa.storage
    .from("media")
    .download(asset.storage_path);
  if (dlError || !fileData) return jsonError("Could not load the asset file from storage", 500);
  const imageBuffer = Buffer.from(await fileData.arrayBuffer());

  const generated = await generateDesigns({ imageBuffer, headline, sub, brief, username, format });
  if (generated.length === 0) return jsonError("Design generation produced no variants", 500);

  const { width, height } = SURFACE_DIMENSIONS[format];

  const uploads = await Promise.all(
    generated.map(async (d) => {
      const { path, publicUrl } = await uploadToMedia(supa, user.id, d.buffer, "jpg", "designs");
      return {
        user_id: user.id,
        asset_id: asset.id,
        provider: d.provider,
        template_key: d.templateKey,
        label: d.label,
        brief: brief ?? null,
        storage_path: path,
        public_url: publicUrl,
        width,
        height,
        format,
        selected: false,
      };
    }),
  ).catch((err: unknown) => {
    console.error("design upload failed", err);
    return null;
  });
  if (!uploads) return jsonError("Could not upload the generated designs", 500);

  const { data: designs, error: insertError } = await supa
    .from("designs")
    .insert(uploads)
    .select();
  if (insertError || !designs) {
    return jsonError(insertError?.message ?? "Could not save the designs", 500);
  }

  return jsonOk({ designs: designs as Design[] });
}
