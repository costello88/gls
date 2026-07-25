import { beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME, createSessionCookieValue, isValidSessionCookie } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("exports a cookie name", () => {
    expect(COOKIE_NAME).toBe("gls_session");
  });

  it("validates a freshly created session cookie", async () => {
    const value = await createSessionCookieValue();
    expect(await isValidSessionCookie(value)).toBe(true);
  });

  it("rejects an undefined cookie", async () => {
    expect(await isValidSessionCookie(undefined)).toBe(false);
  });

  it("rejects a garbage cookie", async () => {
    expect(await isValidSessionCookie("not-a-real-cookie")).toBe(false);
  });

  it("rejects a tampered cookie", async () => {
    const value = await createSessionCookieValue();
    const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
    expect(await isValidSessionCookie(tampered)).toBe(false);
  });
});
