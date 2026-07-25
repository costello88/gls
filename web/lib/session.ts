import crypto from "crypto";

export const COOKIE_NAME = "gls_session";
const SESSION_VALUE = "authenticated";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET is not set");
  }
  return secret;
}

function sign(value: string): string {
  const hmac = crypto.createHmac("sha256", getSecret()).update(value).digest("hex");
  return `${value}.${hmac}`;
}

export function createSessionCookieValue(): string {
  return sign(SESSION_VALUE);
}

export function isValidSessionCookie(value: string | undefined): boolean {
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
  const expected = sign(payload).split(".")[1];
  if (signature.length !== expected.length) {
    return false;
  }
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}
