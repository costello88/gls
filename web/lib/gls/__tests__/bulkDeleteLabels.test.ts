import { describe, expect, it, vi } from "vitest";

vi.mock("../deleteLabel", () => ({
  deleteGlsLabel: vi.fn(),
}));

import { deleteGlsLabel } from "../deleteLabel";
import { bulkDeleteLabels } from "../bulkDeleteLabels";

const mockedDeleteGlsLabel = vi.mocked(deleteGlsLabel);

describe("bulkDeleteLabels", () => {
  it("deletes every unit number and reports per-item success", async () => {
    mockedDeleteGlsLabel.mockResolvedValueOnce(undefined).mockResolvedValueOnce(undefined);

    const results = await bulkDeleteLabels(["111", "222"]);

    expect(results).toEqual([
      { unitNo: "111", success: true },
      { unitNo: "222", success: true },
    ]);
  });

  it("continues past failures and reports them per item", async () => {
    mockedDeleteGlsLabel
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Unit not found"))
      .mockResolvedValueOnce(undefined);

    const results = await bulkDeleteLabels(["111", "222", "333"]);

    expect(results).toEqual([
      { unitNo: "111", success: true },
      { unitNo: "222", success: false, error: "Unit not found" },
      { unitNo: "333", success: true },
    ]);
  });
});
