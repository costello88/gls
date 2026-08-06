/**
 * Design orchestrator: one photo + text → many Instagram-ready designs.
 * The template engine always runs; AI providers join in when their keys exist.
 */

import type { DesignProvider } from "@/lib/types";
import { TEMPLATES, type TemplateBrief } from "./templates";
import { dominantColor, renderTemplate, type RenderFormat } from "./render";
import { openaiAvailable, openaiVariants } from "./providers/openai";
import { anthropicAvailable, anthropicDirections } from "./providers/anthropic";
import { replicateAvailable, replicateVariants } from "./providers/replicate";
import { higgsfieldAvailable, higgsfieldVariants } from "./providers/higgsfield";

export interface GenerateDesignsInput {
  imageBuffer: Buffer;
  headline: string;
  sub?: string;
  brief?: string;
  username?: string;
  format: RenderFormat;
  /** Template keys to render; defaults to all 8. */
  templates?: string[];
  includeAi?: boolean;
}

export interface GeneratedDesign {
  buffer: Buffer;
  provider: DesignProvider;
  label: string;
  templateKey: string | null;
}

export function availableProviders(): DesignProvider[] {
  const list: DesignProvider[] = ["template"];
  if (openaiAvailable()) list.push("openai");
  if (anthropicAvailable()) list.push("anthropic");
  if (replicateAvailable()) list.push("replicate");
  if (higgsfieldAvailable()) list.push("higgsfield");
  return list;
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export async function generateDesigns(input: GenerateDesignsInput): Promise<GeneratedDesign[]> {
  const accent = await dominantColor(input.imageBuffer);
  const brief: TemplateBrief = {
    headline: input.headline,
    sub: input.sub,
    accent,
    username: input.username,
  };
  const styleBrief = input.brief || input.headline;
  const keys = input.templates?.length
    ? input.templates
    : TEMPLATES.map((t) => t.key);

  const templateJobs = keys.map(async (key): Promise<GeneratedDesign | null> => {
    try {
      const buffer = await renderTemplate(input.imageBuffer, key, brief, input.format);
      const spec = TEMPLATES.find((t) => t.key === key);
      return { buffer, provider: "template", label: spec?.label ?? key, templateKey: key };
    } catch (err) {
      console.error(`template ${key} failed`, err);
      return null;
    }
  });

  const aiJobs: Array<Promise<GeneratedDesign[]>> = [];
  if (input.includeAi !== false) {
    if (openaiAvailable()) {
      aiJobs.push(
        withTimeout(openaiVariants(input.imageBuffer, styleBrief, input.format), 120_000, []).then(
          (v) => v.map((x) => ({ ...x, provider: "openai" as const, templateKey: null })),
        ),
      );
    }
    if (anthropicAvailable()) {
      aiJobs.push(
        withTimeout(
          anthropicDirections(
            input.imageBuffer,
            input.headline,
            styleBrief,
            input.format,
            input.username,
          ),
          90_000,
          [],
        ).then((v) => v.map((x) => ({ ...x, provider: "anthropic" as const }))),
      );
    }
    if (replicateAvailable()) {
      aiJobs.push(
        withTimeout(replicateVariants(input.imageBuffer, styleBrief, input.format), 120_000, []).then(
          (v) => v.map((x) => ({ ...x, provider: "replicate" as const, templateKey: null })),
        ),
      );
    }
    if (higgsfieldAvailable()) {
      aiJobs.push(
        withTimeout(higgsfieldVariants(input.imageBuffer, styleBrief, input.format), 120_000, []).then(
          (v) => v.map((x) => ({ ...x, provider: "higgsfield" as const, templateKey: null })),
        ),
      );
    }
  }

  const [templateResults, ...aiResults] = await Promise.all([
    Promise.all(templateJobs),
    ...aiJobs,
  ]);

  return [
    ...templateResults.filter((d): d is GeneratedDesign => d !== null),
    ...aiResults.flat(),
  ];
}
