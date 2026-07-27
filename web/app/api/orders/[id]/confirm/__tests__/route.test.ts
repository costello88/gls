import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../lib/gls/confirmLabel", () => ({
  confirmGlsLabel: vi.fn(),
}));

import { confirmGlsLabel } from "../../../../../../lib/gls/confirmLabel";
import { GlsApiError } from "../../../../../../lib/gls/errors";
import { handleConfirmLabel } from "../shared";

const mockedConfirmGlsLabel = vi.mocked(confirmGlsLabel);

describe("handleConfirmLabel", () => {
  it("confirms the given unit number and returns ok", async () => {
    mockedConfirmGlsLabel.mockResolvedValue(undefined);
    const request = new Request("https://example.com/api/orders/1/confirm", {
      method: "POST",
      body: JSON.stringify({ unitNo: "11850080202728" }),
    });

    const response = await handleConfirmLabel(request);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedConfirmGlsLabel).toHaveBeenCalledWith("11850080202728");
  });

  it("returns a 502 with the GLS error message on failure", async () => {
    mockedConfirmGlsLabel.mockRejectedValue(new GlsApiError("Unit not found", 424));
    const request = new Request("https://example.com/api/orders/1/confirm", {
      method: "POST",
      body: JSON.stringify({ unitNo: "does-not-exist" }),
    });

    const response = await handleConfirmLabel(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe("Unit not found");
  });
});
