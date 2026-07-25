const DEFAULT_BASE_URL = "https://api.gls.nl/v1/api";

export interface GlsApiResponse {
  httpStatus: number;
  json: unknown | null;
  text: string;
}

export async function postGlsApi(path: string, body: unknown): Promise<GlsApiResponse> {
  const baseUrl = process.env.GLS_API_BASE_URL ?? DEFAULT_BASE_URL;
  const response = await fetch(`${baseUrl}${path}?api-version=1.0`, {
    method: "POST",
    headers: { "Content-Type": "application/json-patch+json" },
    body: JSON.stringify(body),
  });

  const text = await response.text();
  let json: unknown | null = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  return { httpStatus: response.status, json, text };
}
