export const COOKIE_NAME = "gls_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function toHex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sign(value: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(getSecret()),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signatureBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value));
  return `${value}.${toHex(signatureBuffer)}`;
}

export async function createSessionCookieValue(): Promise<string> {
  return sign(SESSION_VALUE);
}

export async function isValidSessionCookie(value: string | undefined): Promise<boolean> {
  if (!value) {
    return false;
  }
  const parts = value.split(".");
  if (parts.length !== 2) {
    return false;
  }
  const [payload, signature] = parts;
  if (payload !== SESSION_VALUE) {
    return false;
  }
  const expectedSigned = await sign(payload);
  const expected = expectedSigned.split(".")[1];
  if (signature.length !== expected.length) {
    return false;
  }
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expected.charCodeAt(i);
  }
  return mismatch === 0;
}
