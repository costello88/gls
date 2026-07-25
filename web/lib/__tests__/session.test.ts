import { beforeEach, describe, expect, it } from "vitest";
import { COOKIE_NAME, createSessionCookieValue, isValidSessionCookie } from "../session";

describe("session", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("exports a cookie name", () => {
    expect(COOKIE_NAME).toBe("gls_session");
  });

  it("validates a freshly created session cookie", () => {
    const value = createSessionCookieValue();
    expect(isValidSessionCookie(value)).toBe(true);
  });

  it("rejects an undefined cookie", () => {
    expect(isValidSessionCookie(undefined)).toBe(false);
  });

  it("rejects a garbage cookie", () => {
    expect(isValidSessionCookie("not-a-real-cookie")).toBe(false);
  });

  it("rejects a tampered cookie", () => {
    const value = createSessionCookieValue();
    const tampered = value.slice(0, -1) + (value.endsWith("a") ? "b" : "a");
    expect(isValidSessionCookie(tampered)).toBe(false);
  });
});
