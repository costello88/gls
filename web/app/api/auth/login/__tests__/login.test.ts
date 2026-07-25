import { beforeEach, describe, expect, it } from "vitest";
import { POST } from "../route";

describe("POST /api/auth/login", () => {
  beforeEach(() => {
    process.env.SESSION_SECRET = "test-secret";
    process.env.DASHBOARD_PASSWORD = "correct-password";
  });

  it("rejects the wrong password", async () => {
    const request = new Request("https://example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "wrong" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it("accepts the correct password and sets a session cookie", async () => {
    const request = new Request("https://example.com/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ password: "correct-password" }),
    });
    const response = await POST(request);
    expect(response.status).toBe(200);
    expect(response.headers.get("set-cookie")).toContain("gls_session=");
  });
});
