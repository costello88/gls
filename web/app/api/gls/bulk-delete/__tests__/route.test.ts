import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/gls/bulkDeleteLabels", () => ({
  bulkDeleteLabels: vi.fn(),
}));

import { bulkDeleteLabels } from "../../../../../lib/gls/bulkDeleteLabels";
import { handleBulkDelete } from "../shared";

const mockedBulkDeleteLabels = vi.mocked(bulkDeleteLabels);

describe("handleBulkDelete", () => {
  it("passes the submitted unit numbers through and returns the results", async () => {
    mockedBulkDeleteLabels.mockResolvedValue([
      { unitNo: "111", success: true },
      { unitNo: "222", success: false, error: "Unit not found" },
    ]);
    const request = new Request("https://example.com/api/gls/bulk-delete", {
      method: "POST",
      body: JSON.stringify({ unitNos: ["111", "222"] }),
    });

    const response = await handleBulkDelete(request);
    const body = (await response.json()) as { results: unknown[] };

    expect(response.status).toBe(200);
    expect(body.results).toHaveLength(2);
    expect(mockedBulkDeleteLabels).toHaveBeenCalledWith(["111", "222"]);
  });
});
