/**
 * Replicate FLUX Kontext: image+prompt → restyled image with native
 * Instagram aspect ratios (no cropping needed).
 */

import { normalizeToFormat, type RenderFormat } from "../render";

export function replicateAvailable(): boolean {
  return Boolean(process.env.REPLICATE_API_TOKEN);
}

export async function replicateVariants(
  imageBuf: Buffer,
  brief: string,
  format: RenderFormat,
  count = 2,
): Promise<Array<{ buffer: Buffer; label: string }>> {
  if (!replicateAvailable()) return [];

  const model = process.env.REPLICATE_IMAGE_MODEL || "black-forest-labs/flux-kontext-pro";
  const aspect = format === "story" ? "9:16" : "4:5";
  const prompts = [
    `Transform this into a scroll-stopping Instagram visual: cinematic lighting, rich texture, premium brand feel. ${brief}`,
    `Transform this into a clean minimalist Instagram visual: generous negative space, soft gradient backdrop, modern aesthetic. ${brief}`,
  ].slice(0, count);

  const results = await Promise.allSettled(
    prompts.map(async (prompt, i) => {
      const res = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.REPLICATE_API_TOKEN}`,
          "Content-Type": "application/json",
          Prefer: "wait",
        },
        body: JSON.stringify({
          input: {
            prompt,
            input_image: `data:image/jpeg;base64,${imageBuf.toString("base64")}`,
            aspect_ratio: aspect,
            output_format: "jpg",
          },
        }),
      });
      if (!res.ok) throw new Error(`Replicate HTTP ${res.status}`);
      const body = (await res.json()) as { output?: string | string[]; error?: string };
      if (body.error) throw new Error(body.error);
      const url = Array.isArray(body.output) ? body.output[0] : body.output;
      if (!url) throw new Error("Replicate returned no output");
      const img = await fetch(url);
      const buffer = await normalizeToFormat(Buffer.from(await img.arrayBuffer()), format);
      return { buffer, label: ["Flux · Cinematic", "Flux · Minimal"][i] ?? `Flux ${i + 1}` };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ buffer: Buffer; label: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}
