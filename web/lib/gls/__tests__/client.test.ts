import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { postGlsApi } from "../client";

describe("postGlsApi", () => {
  const originalFetch = global.fetch;
  const originalBaseUrl = process.env.GLS_API_BASE_URL;

  beforeEach(() => {
    delete process.env.GLS_API_BASE_URL;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    if (originalBaseUrl === undefined) {
      delete process.env.GLS_API_BASE_URL;
    } else {
      process.env.GLS_API_BASE_URL = originalBaseUrl;
    }
  });

  it("posts to the default production base URL with the expected request shape", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => JSON.stringify({ hello: "world" }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await postGlsApi("/Label/Create", { foo: "bar" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.gls.nl/v1/api/Label/Create?api-version=1.0",
      {
        method: "POST",
        headers: { "Content-Type": "application/json-patch+json" },
        body: JSON.stringify({ foo: "bar" }),
      },
    );
    expect(result).toEqual({
      httpStatus: 200,
      json: { hello: "world" },
      text: JSON.stringify({ hello: "world" }),
    });
  });

  it("uses GLS_API_BASE_URL when set", async () => {
    process.env.GLS_API_BASE_URL = "https://api.gls.nl/test/v1/api";
    const mockFetch = vi.fn().mockResolvedValue({
      status: 200,
      text: async () => "{}",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await postGlsApi("/Authentication/ValidateLogin", { username: "u", password: "p" });

    expect(mockFetch).toHaveBeenCalledWith(
      "https://api.gls.nl/test/v1/api/Authentication/ValidateLogin?api-version=1.0",
      expect.any(Object),
    );
  });

  it("returns json: null and the raw text when the body is not valid JSON", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      status: 500,
      text: async () => "<html>Internal Server Error</html>",
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const result = await postGlsApi("/Label/Create", {});

    expect(result).toEqual({
      httpStatus: 500,
      json: null,
      text: "<html>Internal Server Error</html>",
    });
  });
});
