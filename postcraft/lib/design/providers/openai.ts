/**
 * OpenAI image editing: the uploaded photo + a style prompt → restyled variants.
 * Uses /v1/images/edits with input_fidelity=high to preserve the product/subject.
 */

import { normalizeToFormat, type RenderFormat } from "../render";

const MODEL = () => process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";

export function openaiAvailable(): boolean {
  return Boolean(process.env.OPENAI_API_KEY);
}

const STYLE_PROMPTS = [
  "Rework this photo into a premium Instagram graphic: moody studio lighting, deep shadows, editorial magazine look. Keep the main subject exactly as it is.",
  "Rework this photo into a bright, airy lifestyle scene with soft natural light and clean minimal background. Keep the main subject exactly as it is.",
  "Rework this photo into a bold color-blocked poster style with vivid complementary background colors. Keep the main subject exactly as it is.",
];

export async function openaiVariants(
  imageBuf: Buffer,
  brief: string,
  format: RenderFormat,
  count = 3,
): Promise<Array<{ buffer: Buffer; label: string }>> {
  if (!openaiAvailable()) return [];

  const styles = STYLE_PROMPTS.slice(0, Math.max(1, Math.min(count, STYLE_PROMPTS.length)));
  const results = await Promise.allSettled(
    styles.map(async (style, i) => {
      const form = new FormData();
      form.append("model", MODEL());
      form.append("image", new Blob([new Uint8Array(imageBuf)], { type: "image/jpeg" }), "input.jpg");
      form.append(
        "prompt",
        `${style} Context for the design: ${brief}. Compose for a ${format === "story" ? "9:16 vertical story" : "4:5 portrait feed post"}; keep key content centered and clear of the outer edges.`,
      );
      form.append("n", "1");
      form.append("size", "1024x1536");
      form.append("quality", process.env.OPENAI_IMAGE_QUALITY || "medium");
      form.append("input_fidelity", "high");

      const res = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${process.env.OPENAI_API_KEY}` },
        body: form,
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
        throw new Error(err.error?.message ?? `OpenAI images error HTTP ${res.status}`);
      }
      const body = (await res.json()) as { data: Array<{ b64_json?: string }> };
      const b64 = body.data?.[0]?.b64_json;
      if (!b64) throw new Error("OpenAI returned no image data");
      const buffer = await normalizeToFormat(Buffer.from(b64, "base64"), format);
      return { buffer, label: ["Studio edit", "Lifestyle edit", "Color-block edit"][i] ?? `AI edit ${i + 1}` };
    }),
  );

  return results
    .filter((r): r is PromiseFulfilledResult<{ buffer: Buffer; label: string }> => r.status === "fulfilled")
    .map((r) => r.value);
}
