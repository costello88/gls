/** Thin Claude Messages API helper. All AI copy features degrade gracefully without a key. */

export function claudeAvailable(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function askClaude(system: string, user: string, maxTokens = 2000): Promise<string | null> {
  if (!claudeAvailable()) return null;
  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": process.env.ANTHROPIC_API_KEY!,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.ANTHROPIC_MODEL || "claude-sonnet-5",
        max_tokens: maxTokens,
        system,
        messages: [{ role: "user", content: user }],
      }),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    return body.content?.find((c) => c.type === "text")?.text ?? null;
  } catch {
    return null;
  }
}

/** Extract the first JSON array/object from a model reply. */
export function extractJson<T>(text: string | null): T | null {
  if (!text) return null;
  const match = text.match(/[[{][\s\S]*[\]}]/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as T;
  } catch {
    return null;
  }
}
