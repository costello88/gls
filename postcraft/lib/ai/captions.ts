import { z } from "zod";
import { askClaude, extractJson } from "./claude";
import type { CaptionSet } from "@/lib/types";

export type CaptionTone = "confident" | "playful" | "minimal" | "storyteller" | "salesy";

const CaptionSetSchema = z.object({
  caption: z.string().min(1).max(2200),
  hashtags: z.array(z.string()).max(5),
  first_comment: z.string().max(2200).optional(),
});

const SYSTEM = `You are an elite Instagram copywriter. Current platform reality:
- The first 125 characters are the feed truncation point — the hook must live there.
- Structure: hook → value → specific CTA. Specific CTAs outperform generic ~3x.
- Keyword-rich captions beat hashtag-heavy ones; Instagram now caps distribution at 5 hashtags. Use 3-5 laser-relevant tags.
- Saves and shares are the highest-value signals — write captions that earn them.`;

/** Generate n caption alternatives. Falls back to a solid deterministic template without a key. */
export async function generateCaptions(
  brief: string,
  tone: CaptionTone,
  n = 3,
  surface: "feed" | "reel" | "story" | "carousel" = "feed",
): Promise<CaptionSet[]> {
  const text = await askClaude(
    SYSTEM,
    `Write ${n} distinct Instagram ${surface} captions for: ${brief}
Tone: ${tone}.
Each: hook in the first 125 chars, 2-4 short paragraphs (line breaks allowed), one specific CTA, 3-5 hashtags (no # spam).
Also provide an optional "first_comment" that extends value (a tip list or context), not extra hashtags.
Reply ONLY with a JSON array: [{"caption": "...", "hashtags": ["tag1", ...], "first_comment": "..."}]`,
    2500,
  );

  const parsed = extractJson<unknown>(text);
  if (parsed) {
    const result = z.array(CaptionSetSchema).safeParse(parsed);
    if (result.success && result.data.length > 0) {
      return result.data.slice(0, n).map((c) => ({
        ...c,
        hashtags: c.hashtags.map((t) => t.replace(/^#/, "")).slice(0, 5),
      }));
    }
  }

  return fallbackCaptions(brief, tone, n);
}

function fallbackCaptions(brief: string, tone: CaptionTone, n: number): CaptionSet[] {
  const topic = brief.slice(0, 80);
  const base: CaptionSet[] = [
    {
      caption: `${topic} — here's what makes it worth your time.\n\nWe put everything into this one, and it shows in the details.\n\nSave this post so you don't lose it, and tell us below: what would you pick?`,
      hashtags: hashtagsFrom(brief),
    },
    {
      caption: `Stop scrolling — ${topic.toLowerCase()} just landed.\n\nEverything you need to know is right here.\n\nDouble-tap if this is your vibe, and share it with someone who needs to see it.`,
      hashtags: hashtagsFrom(brief),
    },
    {
      caption: `${topic}.\n\nNo noise, just the good stuff.\n\nFollow for more like this.`,
      hashtags: hashtagsFrom(brief),
    },
  ];
  return base.slice(0, n);
}

function hashtagsFrom(brief: string): string[] {
  const words = brief
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3)
    .slice(0, 3);
  return [...words, "instagood"].slice(0, 4);
}
