import { createHash, randomBytes } from "crypto";

export interface DrawCandidate {
  id: string;
  username: string;
}

/** Generate a draw seed once per giveaway; stored so the draw is reproducible. */
export function newDrawSeed(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Deterministic, verifiably fair winner selection.
 * One ticket per unique username (first entry wins the ticket), ranked by
 * SHA-256(seed:username) — anyone with the seed and the entrant list can
 * reproduce the result.
 */
export function drawWinners(
  entries: DrawCandidate[],
  count: number,
  seed: string,
): DrawCandidate[] {
  const byUsername = new Map<string, DrawCandidate>();
  for (const e of entries) {
    const u = e.username.toLowerCase();
    if (!byUsername.has(u)) byUsername.set(u, e);
  }

  const ranked = [...byUsername.values()]
    .map((entry) => ({
      entry,
      rank: createHash("sha256").update(`${seed}:${entry.username.toLowerCase()}`).digest("hex"),
    }))
    .sort((a, b) => (a.rank < b.rank ? -1 : a.rank > b.rank ? 1 : 0));

  return ranked.slice(0, Math.max(0, count)).map((r) => r.entry);
}
