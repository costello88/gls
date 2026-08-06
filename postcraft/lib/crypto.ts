import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

/**
 * AES-256-GCM encryption for Meta access tokens at rest.
 * TOKEN_ENCRYPTION_KEY must be 64 hex chars (32 bytes) — generate with:
 *   openssl rand -hex 32
 * Format: base64url(iv).base64url(tag).base64url(ciphertext)
 */

function key(): Buffer {
  const hex = process.env.TOKEN_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("TOKEN_ENCRYPTION_KEY must be set to 64 hex characters (openssl rand -hex 32)");
  }
  return Buffer.from(hex, "hex");
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, enc].map((b) => b.toString("base64url")).join(".");
}

export function decryptToken(encoded: string): string {
  const [ivB, tagB, dataB] = encoded.split(".");
  if (!ivB || !tagB || !dataB) throw new Error("Malformed encrypted token");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(ivB, "base64url"));
  decipher.setAuthTag(Buffer.from(tagB, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}
