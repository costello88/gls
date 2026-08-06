/**
 * Minimal Instagram Platform API client ("Instagram API with Instagram Login").
 * Host: graph.instagram.com — no Facebook Page required.
 */

const VERSION = process.env.META_GRAPH_VERSION || "v25.0";
export const GRAPH_HOST = `https://graph.instagram.com/${VERSION}`;

export class MetaApiError extends Error {
  code: number | null;
  subcode: number | null;
  fbtraceId: string | null;

  constructor(message: string, code: number | null = null, subcode: number | null = null, fbtraceId: string | null = null) {
    super(message);
    this.name = "MetaApiError";
    this.code = code;
    this.subcode = subcode;
    this.fbtraceId = fbtraceId;
  }
}

interface GraphOptions {
  method?: "GET" | "POST" | "DELETE";
  params?: Record<string, string | number | boolean | undefined>;
  host?: string;
}

export async function graph<T = Record<string, unknown>>(
  path: string,
  accessToken: string,
  { method = "GET", params = {}, host = GRAPH_HOST }: GraphOptions = {},
): Promise<T> {
  const url = new URL(`${host}${path.startsWith("/") ? path : `/${path}`}`);
  const search = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined) search.set(k, String(v));
  }
  search.set("access_token", accessToken);

  let res: Response;
  if (method === "GET" || method === "DELETE") {
    url.search = search.toString();
    res = await fetch(url, { method, cache: "no-store" });
  } else {
    res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: search.toString(),
      cache: "no-store",
    });
  }

  const body = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok || body.error) {
    const err = (body.error ?? {}) as Record<string, unknown>;
    throw new MetaApiError(
      String(err.message ?? `Graph API error (HTTP ${res.status})`),
      typeof err.code === "number" ? err.code : null,
      typeof err.error_subcode === "number" ? err.error_subcode : null,
      typeof err.fbtrace_id === "string" ? err.fbtrace_id : null,
    );
  }
  return body as T;
}
