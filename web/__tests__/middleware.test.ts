import { beforeEach, describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "../middleware";
import { COOKIE_NAME, createSessionCookieValue } from "../lib/session";

describe("middleware", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
  });

  it("redirects to /login when no session cookie is present", async () => {
    const request = new NextRequest("https://example.com/");
    const response = await middleware(request);
    expect(response.headers.get("location")).toContain("/login");
  });

  it("allows /login through without a cookie", async () => {
    const request = new NextRequest("https://example.com/login");
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("allows the request through with a valid session cookie", async () => {
    const request = new NextRequest("https://example.com/", {
      headers: { cookie: `${COOKIE_NAME}=${await createSessionCookieValue()}` },
    });
    const response = await middleware(request);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects when the session cookie is invalid", async () => {
    const request = new NextRequest("https://example.com/", {
      headers: { cookie: `${COOKIE_NAME}=garbage` },
    });
    const response = await middleware(request);
    expect(response.headers.get("location")).toContain("/login");
  });
});
