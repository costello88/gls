import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../../lib/gls/deleteLabel", () => ({
  deleteGlsLabel: vi.fn(),
}));

import { deleteGlsLabel } from "../../../../../../lib/gls/deleteLabel";
import { GlsApiError } from "../../../../../../lib/gls/errors";
import { handleDeleteLabel } from "../shared";

const mockedDeleteGlsLabel = vi.mocked(deleteGlsLabel);

describe("handleDeleteLabel", () => {
  it("deletes the given unit number and returns ok", async () => {
    mockedDeleteGlsLabel.mockResolvedValue(undefined);
    const request = new Request("https://example.com/api/orders/1/delete-label", {
      method: "POST",
      body: JSON.stringify({ unitNo: "11850080202728" }),
    });

    const response = await handleDeleteLabel(request);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(mockedDeleteGlsLabel).toHaveBeenCalledWith("11850080202728");
  });

  it("returns a 502 with the GLS error message on failure", async () => {
    mockedDeleteGlsLabel.mockRejectedValue(new GlsApiError("Unit not found", 424));
    const request = new Request("https://example.com/api/orders/1/delete-label", {
      method: "POST",
      body: JSON.stringify({ unitNo: "does-not-exist" }),
    });

    const response = await handleDeleteLabel(request);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe("Unit not found");
  });
});
