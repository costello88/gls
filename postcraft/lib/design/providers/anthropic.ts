/**
 * Claude as art director: it studies the brief and returns structured design
 * directions (template + palette + rewritten display copy), which the local
 * template engine renders. Deterministic to raster, creative in direction.
 */

import { z } from "zod";
import { TEMPLATES, type TemplateBrief } from "../templates";
import { renderTemplate, type RenderFormat } from "../render";

export function anthropicAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

const DirectionSchema = z.object({
  template: z.string(),
  headline: z.string().min(1).max(80),
  sub: z.string().max(120).nullish(),
  accent: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  label: z.string().max(40),
});

export async function anthropicDirections(
  imageBuf: Buffer,
  headline: string,
  brief: string,
  format: RenderFormat,
  username: string | undefined,
  count = 3,
): Promise<Array<{ buffer: Buffer; label: string; templateKey: string }>> {
  if (!anthropicAvailable()) return [];

  const keys = TEMPLATES.map((t) => t.key).join(", ");
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
      max_tokens: 1500,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: "image/jpeg", data: imageBuf.toString("base64") },
            },
            {
              type: "text",
              text: `You are the art director for an Instagram ${format === "story" ? "story" : "feed post"}.
Photo: attached. Working headline: "${headline}". Brief: ${brief || "none"}.
Available layout templates: ${keys}.
Design ${count} distinct directions. For each: pick the template that best fits the photo's composition, sharpen the headline into display copy (max 6 words, punchy, no hashtags), optionally a sub-line (max 12 words), and choose an accent hex that complements the photo.
Reply with ONLY a JSON array: [{"template": "...", "headline": "...", "sub": "...", "accent": "#rrggbb", "label": "short direction name"}]`,
            },
          ],
        },
      ],
    }),
  });

  if (!res.ok) return [];
  const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
  const text = body.content?.find((c) => c.type === "text")?.text ?? "";
  const match = text.match(/\[[\s\S]*\]/);
  if (!match) return [];

  let directions: z.infer<typeof DirectionSchema>[] = [];
  try {
    const parsed: unknown = JSON.parse(match[0]);
    directions = z.array(DirectionSchema).parse(parsed).slice(0, count);
  } catch {
    return [];
  }

  const rendered = await Promise.allSettled(
    directions.map(async (d) => {
      const template = TEMPLATES.some((t) => t.key === d.template) ? d.template : TEMPLATES[0].key;
      const briefObj: TemplateBrief = {
        headline: d.headline,
        sub: d.sub ?? undefined,
        accent: d.accent,
        username,
      };
      const buffer = await renderTemplate(imageBuf, template, briefObj, format);
      return { buffer, label: `Claude · ${d.label}`, templateKey: template };
    }),
  );

  return rendered
    .filter(
      (r): r is PromiseFulfilledResult<{ buffer: Buffer; label: string; templateKey: string }> =>
        r.status === "fulfilled",
    )
    .map((r) => r.value);
}
