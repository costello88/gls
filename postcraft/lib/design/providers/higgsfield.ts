/**
 * Higgsfield (Soul image model). Higgsfield's programmatic access is via its
 * gated Cloud API — there is no public self-serve REST API — so this adapter
 * is best-effort: endpoints are configurable and any failure degrades
 * silently to the other providers.
 */

import { normalizeToFormat, type RenderFormat } from "../render";

export function higgsfieldAvailable(): boolean {
  return Boolean(process.env.HIGGSFIELD_API_KEY && process.env.HIGGSFIELD_API_SECRET);
}

export async function higgsfieldVariants(
  imageBuf: Buffer,
  brief: string,
  format: RenderFormat,
  count = 1,
): Promise<Array<{ buffer: Buffer; label: string }>> {
  if (!higgsfieldAvailable()) return [];

  const base = process.env.HIGGSFIELD_API_BASE || "https://platform.higgsfield.ai/v1";
  try {
    const createRes = await fetch(`${base}/image2image/soul`, {
      method: "POST",
      headers: {
        "hf-api-key": process.env.HIGGSFIELD_API_KEY!,
        "hf-secret": process.env.HIGGSFIELD_API_SECRET!,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        params: {
          prompt: `Premium Instagram visual, fashion-editorial aesthetic. ${brief}`,
          image: { type: "base64", data: imageBuf.toString("base64") },
          aspect_ratio: format === "story" ? "9:16" : "4:5",
          batch_size: Math.min(count, 4),
        },
      }),
    });
    if (!createRes.ok) return [];
    const job = (await createRes.json()) as { id?: string; jobs?: Array<{ id: string }> };
    const jobId = job.id ?? job.jobs?.[0]?.id;
    if (!jobId) return [];

    // Poll for completion (max ~90s).
    for (let attempt = 0; attempt < 18; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));
      const pollRes = await fetch(`${base}/jobs/${jobId}`, {
        headers: {
          "hf-api-key": process.env.HIGGSFIELD_API_KEY!,
          "hf-secret": process.env.HIGGSFIELD_API_SECRET!,
        },
      });
      if (!pollRes.ok) continue;
      const poll = (await pollRes.json()) as {
        status?: string;
        results?: Array<{ url?: string; raw?: { url?: string } }>;
        jobs?: Array<{ status?: string; results?: { raw?: { url?: string }; min?: { url?: string } } }>;
      };
      const status = poll.status ?? poll.jobs?.[0]?.status;
      if (status === "failed" || status === "canceled") return [];
      if (status === "completed" || status === "succeeded") {
        const urls: string[] = [];
        for (const r of poll.results ?? []) {
          const u = r.url ?? r.raw?.url;
          if (u) urls.push(u);
        }
        for (const j of poll.jobs ?? []) {
          const u = j.results?.raw?.url ?? j.results?.min?.url;
          if (u) urls.push(u);
        }
        const buffers = await Promise.all(
          urls.slice(0, count).map(async (u, i) => {
            const img = await fetch(u);
            const buffer = await normalizeToFormat(Buffer.from(await img.arrayBuffer()), format);
            return { buffer, label: `Soul ${i + 1}` };
          }),
        );
        return buffers;
      }
    }
    return [];
  } catch {
    return [];
  }
}
