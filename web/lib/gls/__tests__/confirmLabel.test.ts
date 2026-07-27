import { beforeEach, describe, expect, it, vi } from "vitest";
import { confirmGlsLabel } from "../confirmLabel";
import { GlsApiError } from "../errors";

vi.mock("../client", () => ({
  postGlsApi: vi.fn(),
}));

import { postGlsApi } from "../client";

const mockedPostGlsApi = vi.mocked(postGlsApi);

beforeEach(() => {
  mockedPostGlsApi.mockReset();
  process.env.GLS_USERNAME = "test-user";
  process.env.GLS_PASSWORD = "test-pass";
});

describe("confirmGlsLabel", () => {
  it("sends the expected request body", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: { error: false, status: "200", transactionId: "txn-1" },
      text: "",
    });

    await confirmGlsLabel("11850080202728");

    expect(mockedPostGlsApi).toHaveBeenCalledWith(
      "/Label/Confirm",
      expect.objectContaining({
        username: "test-user",
        password: "test-pass",
        shiptype: "p",
        unitNo: "11850080202728",
      }),
    );
  });

  it("resolves without throwing on success", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: { error: false, status: "200", transactionId: "txn-1" },
      text: "",
    });

    await expect(confirmGlsLabel("11850080202728")).resolves.toBeUndefined();
  });

  it("throws GlsApiError when error is true inside an HTTP 200 response", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: { error: true, status: "424", message: "Unit not found" },
      text: "",
    });

    await expect(confirmGlsLabel("11850080202728")).rejects.toThrow("Unit not found");
  });

  it("throws GlsApiError for non-200 responses", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 401,
      json: { error: true, status: "401", message: "Unauthorized" },
      text: "",
    });

    await expect(confirmGlsLabel("11850080202728")).rejects.toThrow(GlsApiError);
  });

  it("throws GlsApiError when the response body is not JSON", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: null,
      text: "<html>Internal Server Error</html>",
    });

    await expect(confirmGlsLabel("11850080202728")).rejects.toThrow(GlsApiError);
  });
});
