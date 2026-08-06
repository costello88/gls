import type { GiveawayRequirements } from "@/lib/types";

export interface EntryCheck {
  mentionCount: number;
  hasKeyword: boolean;
  hasHashtag: boolean;
  mentionOk: boolean;
  eligible: boolean;
}

/**
 * Verify a comment against giveaway requirements.
 * Machine-checkable: keyword, hashtag, @-mention count (parsed from the text).
 * `must_follow` / `must_like` cannot be verified through the Instagram API
 * (it exposes no follower or liker lists) — they are honor-system conditions
 * announced in the rules and do not affect machine eligibility.
 */
export function checkEntry(text: string, req: GiveawayRequirements): EntryCheck {
  const mentions = text.match(/@[A-Za-z0-9._]{1,30}/g) ?? [];
  const uniqueMentions = new Set(mentions.map((s) => s.toLowerCase()));
  const mentionCount = uniqueMentions.size;

  const lower = text.toLowerCase();
  const hasKeyword = req.keyword ? lower.includes(req.keyword.toLowerCase()) : true;
  const hashtag = req.hashtag ? (req.hashtag.startsWith("#") ? req.hashtag : `#${req.hashtag}`) : null;
  const hasHashtag = hashtag ? lower.includes(hashtag.toLowerCase()) : true;
  const mentionOk = mentionCount >= (req.mention_count ?? 0);

  return {
    mentionCount,
    hasKeyword,
    hasHashtag,
    mentionOk,
    eligible: hasKeyword && hasHashtag && mentionOk,
  };
}

/** The Instagram-required promotion disclaimer + rules text. */
export function rulesBlurb(req: GiveawayRequirements, prize: string, endsAt: Date): string {
  const parts: string[] = [];
  if (req.must_follow) parts.push("Follow this account");
  if (req.must_like) parts.push("Like this post");
  if (req.mention_count > 0)
    parts.push(`Tag ${req.mention_count} friend${req.mention_count > 1 ? "s" : ""} in the comments`);
  if (req.keyword) parts.push(`Comment with "${req.keyword}"`);
  if (req.hashtag) parts.push(`Include ${req.hashtag.startsWith("#") ? req.hashtag : `#${req.hashtag}`}`);

  const deadline = endsAt.toLocaleDateString("en-US", { month: "long", day: "numeric" });
  return [
    `🎁 GIVEAWAY — win ${prize}!`,
    "",
    "How to enter:",
    ...parts.map((p, i) => `${i + 1}. ${p}`),
    "",
    `Ends ${deadline}. Winner announced here.`,
    "",
    "Per Instagram rules: this promotion is in no way sponsored, endorsed, administered by, or associated with Instagram. By entering, you release Instagram of all responsibility.",
  ].join("\n");
}
