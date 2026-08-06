/**
 * Extract Instagram usernames from arbitrary pasted text: profile URLs,
 * @handles, or bare usernames — mixed with anything else.
 */

const RESERVED = new Set([
  "p",
  "reel",
  "reels",
  "stories",
  "explore",
  "tv",
  "accounts",
  "about",
  "developer",
  "directory",
  "legal",
  "web",
]);

const USERNAME_RE = /^[a-z0-9](?:[a-z0-9._]{0,28}[a-z0-9_])?$/;

function normalize(candidate: string): string | null {
  const u = candidate.trim().toLowerCase().replace(/^@/, "");
  if (!u || u.length > 30) return null;
  if (RESERVED.has(u)) return null;
  if (!USERNAME_RE.test(u)) return null;
  return u;
}

export function parseTargets(raw: string): string[] {
  const found: string[] = [];
  const seen = new Set<string>();

  const push = (candidate: string | null) => {
    if (candidate && !seen.has(candidate)) {
      seen.add(candidate);
      found.push(candidate);
    }
  };

  // 1. URLs: instagram.com/<username>[/...] — ignore content paths like /p/, /reel/.
  const urlRe = /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([A-Za-z0-9._]+)/g;
  let m: RegExpExecArray | null;
  const urlSpans: Array<[number, number]> = [];
  while ((m = urlRe.exec(raw)) !== null) {
    urlSpans.push([m.index, m.index + m[0].length]);
    push(normalize(m[1]));
  }

  // Mask URL regions so their path segments aren't re-parsed as bare handles.
  let masked = raw;
  for (const [start, end] of urlSpans) {
    masked = masked.slice(0, start) + " ".repeat(end - start) + masked.slice(end);
  }

  // 2. @handles and bare tokens.
  for (const token of masked.split(/[\s,;|]+/)) {
    if (!token) continue;
    if (token.startsWith("@")) {
      push(normalize(token));
    } else if (/^[A-Za-z0-9._]+$/.test(token) && (token.includes(".") || token.includes("_") || /\d/.test(token) || token.length >= 3)) {
      // Bare word: accept plausible usernames, but skip common short English noise.
      const n = normalize(token);
      if (n && !COMMON_WORDS.has(n)) push(n);
    }
  }

  return found;
}

const COMMON_WORDS = new Set([
  "the",
  "and",
  "for",
  "you",
  "follow",
  "check",
  "out",
  "these",
  "here",
  "list",
  "with",
  "from",
  "this",
  "all",
  "instagram",
  "http",
  "https",
  "www",
  "com",
]);
