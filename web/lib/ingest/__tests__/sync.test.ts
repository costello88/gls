import { afterEach, describe, expect, it, vi } from "vitest";
import { syncStore } from "../sync";
import type { OrderRecordInput, OrderRepository, StoreConfig } from "../types";
import { makeRawShopifyOrder } from "./fixtures";

class FakeOrderRepository implements OrderRepository {
  created: OrderRecordInput[] = [];
  private existing = new Set<string>();

  seedExisting(storeId: string, sourceOrderId: string) {
    this.existing.add(`${storeId}:${sourceOrderId}`);
  }

  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    return this.existing.has(`${storeId}:${sourceOrderId}`);
  }

  async create(order: OrderRecordInput): Promise<void> {
    this.created.push(order);
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

describe("syncStore", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("inserts a new valid order as PENDING", async () => {
    const order = makeRawShopifyOrder({ id: 1, name: "#1" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 1, valid: 1, invalid: 0 });
    expect(repository.created).toHaveLength(1);
    expect(repository.created[0]).toMatchObject({
      storeId: "store-1",
      sourceOrderId: "1",
      status: "PENDING",
      reviewReason: null,
      weightKg: 1.5,
      customerNo: "11850079",
    });
  });

  it("inserts an invalid order as NEEDS_REVIEW with a reason", async () => {
    const order = makeRawShopifyOrder({ id: 2, name: "#2" });
    order.contact_email = "broken-email";
    order.customer = { email: "broken-email", phone: "+32470123456" };
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 1, valid: 0, invalid: 1 });
    expect(repository.created[0].status).toBe("NEEDS_REVIEW");
    expect(repository.created[0].reviewReason).toContain("Email");
  });

  it("skips an order that already exists for this store", async () => {
    const order = makeRawShopifyOrder({ id: 3, name: "#3" });
    global.fetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    }) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    repository.seedExisting("store-1", "3");

    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 0, valid: 0, invalid: 0 });
    expect(repository.created).toHaveLength(0);
  });

  it("returns an error result without creating any orders when the fetch fails", async () => {
    global.fetch = vi.fn().mockRejectedValue(new Error("network down")) as unknown as typeof fetch;

    const repository = new FakeOrderRepository();
    const result = await syncStore(shopifyStore, repository);

    expect(result).toEqual({ new: 0, valid: 0, invalid: 0, error: "network down" });
    expect(repository.created).toHaveLength(0);
  });
});
