import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../../lib/ingest/preview", () => ({
  previewStoreOrders: vi.fn(),
}));

import { previewStoreOrders } from "../../../../../lib/ingest/preview";
import { handlePreviewSync } from "../shared";
import type { OrderRepository } from "../../../../../lib/ingest/types";
import type { StoreRecord, StoreRepository } from "../../../../../lib/dashboard/types";

const mockedPreviewStoreOrders = vi.mocked(previewStoreOrders);

class FakeStoreRepository implements StoreRepository {
  constructor(private stores: StoreRecord[]) {}

  async list(): Promise<StoreRecord[]> {
    return this.stores;
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.find((s) => s.id === id) ?? null;
  }

  async create(): Promise<StoreRecord> {
    throw new Error("not used");
  }

  async update(): Promise<StoreRecord> {
    throw new Error("not used");
  }

  async delete(): Promise<void> {
    throw new Error("not used");
  }
}

const store1: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: false,
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

describe("handlePreviewSync", () => {
  it("aggregates preview orders across every store", async () => {
    mockedPreviewStoreOrders.mockResolvedValue([
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
      },
    ]);
    const storeRepo = new FakeStoreRepository([store1]);

    const response = await handlePreviewSync(storeRepo, {} as OrderRepository);
    const body = (await response.json()) as { orders: unknown[] };

    expect(response.status).toBe(200);
    expect(body.orders).toHaveLength(1);
    expect(mockedPreviewStoreOrders).toHaveBeenCalledTimes(1);
  });
});
