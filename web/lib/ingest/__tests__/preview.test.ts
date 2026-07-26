import { afterEach, describe, expect, it, vi } from "vitest";
import { previewStoreOrders } from "../preview";
import type { OrderRepository, StoreConfig } from "../types";
import { makeRawShopifyOrder } from "./fixtures";

class FakeOrderRepository implements OrderRepository {
  private existing = new Set<string>();

  seedExisting(storeId: string, sourceOrderId: string) {
    this.existing.add(`${storeId}:${sourceOrderId}`);
  }

  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    return this.existing.has(`${storeId}:${sourceOrderId}`);
  }

  async create(): Promise<void> {
    throw new Error("preview must never create orders");
  }
}

const shopifyStore: StoreConfig = {
  id: "store-1",
  type: "SHOPIFY",
  defaultWeightKg: 1.5,
  customerNo: "11850079",
  shopDomain: "example.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

describe("previewStoreOrders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("returns new orders with store name and date, without creating anything", async () => {
    const order = makeRawShopifyOrder({ id: 1, name: "#1", created_at: "2026-07-25T10:00:00Z" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await previewStoreOrders(shopifyStore, "Revitalash", repository);

    expect(result).toEqual([
      expect.objectContaining({
        storeId: "store-1",
        storeName: "Revitalash",
        sourceOrderId: "1",
        orderDate: "2026-07-25T10:00:00Z",
        name: "Jan Peeters",
      }),
    ]);
  });

  it("excludes orders that already have a row (imported or ignored)", async () => {
    const order = makeRawShopifyOrder({ id: 2, name: "#2" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    repository.seedExisting("store-1", "2");

    const result = await previewStoreOrders(shopifyStore, "Revitalash", repository);

    expect(result).toHaveLength(0);
  });
});
