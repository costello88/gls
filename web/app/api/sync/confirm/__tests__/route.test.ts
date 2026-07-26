import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/dashboard/confirmSync", () => ({
  confirmSyncSelections: vi.fn(),
}));

import { confirmSyncSelections } from "../../../../../lib/dashboard/confirmSync";
import { handleConfirmSync } from "../shared";
import type { StoreRepository } from "../../../../../lib/dashboard/types";
import type { OrderRepository } from "../../../../../lib/ingest/types";

const mockedConfirmSyncSelections = vi.mocked(confirmSyncSelections);

describe("handleConfirmSync", () => {
  it("passes the submitted orders through and returns the result", async () => {
    mockedConfirmSyncSelections.mockResolvedValue({ imported: 1, ignored: 1 });
    const request = new Request("https://example.com/api/sync/confirm", {
      method: "POST",
      body: JSON.stringify({
        orders: [
          {
            storeId: "store-1",
            storeName: "Revitalash",
            sourceOrderId: "1",
            orderNumber: "#1",
            name: "Jan Peeters",
            street: "Kerkstraat",
            houseNo: "12",
            zipCode: "2000",
            city: "Antwerpen",
            countryCode: "BE",
            phone: "+32470123456",
            email: "jan@voorbeeld.be",
            orderDate: "2026-07-25T10:00:00Z",
            selected: true,
          },
        ],
      }),
    });

    const response = await handleConfirmSync(request, {} as StoreRepository, {} as OrderRepository);
    const body = (await response.json()) as { imported: number; ignored: number };

    expect(response.status).toBe(200);
    expect(body).toEqual({ imported: 1, ignored: 1 });
    expect(mockedConfirmSyncSelections).toHaveBeenCalledTimes(1);
  });
});
