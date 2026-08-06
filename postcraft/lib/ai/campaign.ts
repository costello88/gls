import { z } from "zod";
import { addDays, format as formatDate } from "date-fns";
import { askClaude, extractJson } from "./claude";
import type { CampaignDay } from "@/lib/types";

const CampaignDaySchema = z.object({
  day: z.number().int().min(1),
  theme: z.string(),
  surface: z.enum(["feed", "reel", "story", "carousel"]),
  design_direction: z.string(),
  caption_draft: z.string(),
  hashtags: z.array(z.string()).max(5),
  best_time: z.string().regex(/^\d{2}:\d{2}$/),
});

export interface CampaignPlanInput {
  name: string;
  goal: string;
  brief: string;
  startDate: string; // yyyy-MM-dd
  days: number;
}

/**
 * The validated week-long arc: teaser → launch → social proof → value/BTS →
 * giveaway push → urgency → recap. Claude tailors it; the fallback ships it verbatim.
 */
export async function generateCampaignPlan(input: CampaignPlanInput): Promise<CampaignDay[]> {
  const text = await askClaude(
    `You are a senior Instagram campaign strategist. You design multi-day content arcs that compound: teaser builds anticipation, launch converts, social proof sustains, giveaways spike reach, urgency closes.`,
    `Design a ${input.days}-day Instagram campaign.
Campaign: ${input.name}
Goal: ${input.goal}
Brief: ${input.brief}
Proven 7-day arc to adapt (compress or extend for ${input.days} days): Day 1 teaser/countdown → Day 2 launch (reel hero) → Day 3 social proof → Day 4 value/behind-the-scenes → Day 5 giveaway push → Day 6 urgency/last call → Day 7 recap.
Mix surfaces: 2-4 reels, feed posts, at least one story day, optionally one carousel. Best times: mornings 9-11am or evenings 6-8pm.
Reply ONLY with a JSON array of exactly ${input.days} items:
[{"day": 1, "theme": "...", "surface": "feed|reel|story|carousel", "design_direction": "what the visual should look like", "caption_draft": "ready-to-edit caption with hook and CTA", "hashtags": ["3-5 tags"], "best_time": "HH:MM"}]`,
    4000,
  );

  const parsed = extractJson<unknown>(text);
  if (parsed) {
    const result = z.array(CampaignDaySchema).safeParse(parsed);
    if (result.success && result.data.length > 0) {
      return withDates(result.data.slice(0, input.days), input.startDate);
    }
  }
  return withDates(fallbackArc(input), input.startDate);
}

function withDates(days: Omit<CampaignDay, "date">[], startDate: string): CampaignDay[] {
  const start = new Date(`${startDate}T00:00:00`);
  return days.map((d, i) => ({ ...d, day: i + 1, date: formatDate(addDays(start, i), "yyyy-MM-dd") }));
}

function fallbackArc(input: CampaignPlanInput): Omit<CampaignDay, "date">[] {
  const arc: Omit<CampaignDay, "date">[] = [
    {
      day: 1,
      theme: "Teaser",
      surface: "story",
      design_direction: "Cropped close-up of the product, dark moody edit, 'Something is coming' text",
      caption_draft: `Something new drops tomorrow. Any guesses? 👀`,
      hashtags: ["comingsoon", "sneakpeek"],
      best_time: "18:00",
    },
    {
      day: 2,
      theme: "Launch",
      surface: "reel",
      design_direction: "Hero reveal — bright, clean, product front and center with bold headline",
      caption_draft: `It's here. ${input.brief.slice(0, 100)}\n\nTap the link in bio before everyone else does.`,
      hashtags: ["newlaunch", "justdropped"],
      best_time: "11:00",
    },
    {
      day: 3,
      theme: "Social proof",
      surface: "feed",
      design_direction: "Testimonial quote card over a lifestyle shot, serif typography",
      caption_draft: `Don't take our word for it — here's what people are saying.\n\nSave this for later.`,
      hashtags: ["reviews", "community"],
      best_time: "12:00",
    },
    {
      day: 4,
      theme: "Behind the scenes",
      surface: "feed",
      design_direction: "Raw, candid making-of shot with a caption-bar layout",
      caption_draft: `What it actually takes to make this happen.\n\nComment "MORE" if you want the full story.`,
      hashtags: ["behindthescenes", "process"],
      best_time: "17:00",
    },
    {
      day: 5,
      theme: "Giveaway",
      surface: "feed",
      design_direction: "Bold giveaway announcement — badge layout, accent color, GIVEAWAY headline",
      caption_draft: `🎁 GIVEAWAY TIME.\n\n1. Follow us\n2. Like this post\n3. Tag 2 friends below\n\nWinner announced this week. Not sponsored by Instagram.`,
      hashtags: ["giveaway", "win"],
      best_time: "18:00",
    },
    {
      day: 6,
      theme: "Urgency",
      surface: "story",
      design_direction: "Countdown timer aesthetic, high-contrast last-call design",
      caption_draft: `Last call — this wraps tonight. Don't say we didn't warn you ⏳`,
      hashtags: ["lastcall", "endingsoon"],
      best_time: "19:00",
    },
    {
      day: 7,
      theme: "Recap",
      surface: "carousel",
      design_direction: "Week-in-review carousel: best moments, winner announcement, thank-you card",
      caption_draft: `What a week. Here's everything that happened — and the giveaway winner is inside 🎉\n\nFollow so you don't miss the next one.`,
      hashtags: ["recap", "thankyou"],
      best_time: "12:00",
    },
  ];

  if (input.days >= arc.length) return arc.slice(0, input.days);
  // Compress: always keep teaser, launch, and the last day as urgency/close.
  const compressed = [arc[0], arc[1], arc[2], arc[4], arc[5], arc[6]].slice(0, input.days);
  return compressed.map((d, i) => ({ ...d, day: i + 1 }));
}
