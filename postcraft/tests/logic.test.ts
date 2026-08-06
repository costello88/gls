import { beforeAll, describe, expect, it } from "vitest";
import { parseTargets } from "@/lib/outreach/parse";
import { checkEntry } from "@/lib/giveaways/verify";
import { drawWinners } from "@/lib/giveaways/draw";
import { nextBestSlots } from "@/lib/schedule";

describe("crypto", () => {
  beforeAll(() => {
    process.env.TOKEN_ENCRYPTION_KEY = "a".repeat(64);
  });

  it("round-trips a token", async () => {
    const { encryptToken, decryptToken } = await import("@/lib/crypto");
    const token = "EAAG-very-secret-token-1234567890";
    const enc = encryptToken(token);
    expect(enc).not.toContain(token);
    expect(enc.split(".")).toHaveLength(3);
    expect(decryptToken(enc)).toBe(token);
  });

  it("produces different ciphertexts per call (fresh IV)", async () => {
    const { encryptToken } = await import("@/lib/crypto");
    expect(encryptToken("same")).not.toBe(encryptToken("same"));
  });
});

describe("parseTargets", () => {
  it("extracts usernames from profile URLs", () => {
    expect(parseTargets("https://www.instagram.com/nike/ and https://instagram.com/adidas")).toEqual(
      ["nike", "adidas"],
    );
  });

  it("ignores content URLs (posts, reels)", () => {
    const out = parseTargets(
      "https://www.instagram.com/p/Cxyz123/ https://instagram.com/reel/Cabc987/",
    );
    expect(out).toEqual([]);
  });

  it("extracts @handles and bare usernames, dedupes case-insensitively", () => {
    const out = parseTargets("@Nike, nike two.brands_ok\ncheck out these");
    expect(out).toEqual(["nike", "two.brands_ok"]);
  });

  it("handles a messy mixed paste", () => {
    const out = parseTargets(
      `follow list:
       https://instagram.com/brand.one/?igsh=abc
       @brand_two
       instagram.com/brand.three/reels/
       random text here`,
    );
    expect(out).toContain("brand.one");
    expect(out).toContain("brand_two");
    expect(out).toContain("brand.three");
    expect(out).not.toContain("reels");
  });
});

describe("checkEntry", () => {
  const req = {
    must_follow: true,
    must_like: true,
    mention_count: 2,
    keyword: "win",
    hashtag: "summer",
  };

  it("passes a fully qualifying comment", () => {
    const r = checkEntry("I want to WIN! @friend1 @friend2 #summer", req);
    expect(r.mentionCount).toBe(2);
    expect(r.hasKeyword).toBe(true);
    expect(r.hasHashtag).toBe(true);
    expect(r.eligible).toBe(true);
  });

  it("fails when mentions are short or duplicated", () => {
    const r = checkEntry("win #summer @friend1 @friend1", req);
    expect(r.mentionCount).toBe(1);
    expect(r.eligible).toBe(false);
  });

  it("treats null keyword/hashtag as satisfied", () => {
    const r = checkEntry("anything", { ...req, keyword: null, hashtag: null, mention_count: 0 });
    expect(r.eligible).toBe(true);
  });
});

describe("drawWinners", () => {
  const entries = Array.from({ length: 50 }, (_, i) => ({
    id: `e${i}`,
    username: `user${i}`,
  }));

  it("is deterministic for a given seed", () => {
    const a = drawWinners(entries, 3, "seed-1");
    const b = drawWinners(entries, 3, "seed-1");
    expect(a).toEqual(b);
    expect(a).toHaveLength(3);
  });

  it("changes with the seed", () => {
    const a = drawWinners(entries, 3, "seed-1").map((w) => w.username);
    const b = drawWinners(entries, 3, "seed-2").map((w) => w.username);
    expect(a).not.toEqual(b);
  });

  it("gives one ticket per username no matter how many comments", () => {
    const spammy = [
      ...entries,
      ...Array.from({ length: 500 }, (_, i) => ({ id: `dup${i}`, username: "user1" })),
    ];
    const winners = drawWinners(spammy, 50, "seed-x");
    const names = winners.map((w) => w.username);
    expect(new Set(names).size).toBe(names.length);
  });
});

describe("nextBestSlots", () => {
  it("falls back to 11:00/18:00 without a heatmap", () => {
    const from = new Date("2026-08-06T08:00:00");
    const slots = nextBestSlots(null, 2, from);
    expect(slots[0].getHours()).toBe(11);
    expect(slots[1].getHours()).toBe(18);
    expect(slots.every((s) => s > from)).toBe(true);
  });

  it("picks the hottest hour from a heatmap", () => {
    const heat = Array.from({ length: 7 }, () => {
      const row = new Array(24).fill(0);
      row[20] = 99;
      return row;
    });
    const from = new Date("2026-08-06T08:00:00");
    const slots = nextBestSlots(heat, 1, from);
    expect(slots[0].getHours()).toBe(20);
  });
});
