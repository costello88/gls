import { describe, expect, it } from "vitest";
import { confirmSyncSelections } from "../confirmSync";
import type { PreviewOrder } from "../../ingest/preview";
import type { OrderRecordInput, OrderRepository } from "../../ingest/types";
import type { StoreRecord, StoreRepository } from "../types";

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

class FakeOrderRepository implements OrderRepository {
  created: OrderRecordInput[] = [];

  async exists(): Promise<boolean> {
    throw new Error("not used");
  }

  async create(order: OrderRecordInput): Promise<void> {
    this.created.push(order);
  }
}

const store: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: false,
  customerNo: "11850079",
  defaultWeightKg: 1.5,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

function makePreviewOrder(overrides: Partial<PreviewOrder> = {}): PreviewOrder {
  return {
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
    ...overrides,
  };
}

describe("confirmSyncSelections", () => {
  it("imports a selected valid order as PENDING using the store's defaults", async () => {
    const storeRepo = new FakeStoreRepository([store]);
    const orderRepo = new FakeOrderRepository();

    const result = await confirmSyncSelections(storeRepo, orderRepo, [
      { ...makePreviewOrder(), selected: true },
    ]);

    expect(result).toEqual({ imported: 1, ignored: 0 });
    expect(orderRepo.created).toHaveLength(1);
    expect(orderRepo.created[0]).toMatchObject({
      storeId: "store-1",
      sourceOrderId: "1",
      status: "PENDING",
      reviewReason: null,
      weightKg: 1.5,
      customerNo: "11850079",
    });
  });

  it("imports a selected invalid order as NEEDS_REVIEW with a reason", async () => {
    const storeRepo = new FakeStoreRepository([store]);
    const orderRepo = new FakeOrderRepository();

    const result = await confirmSyncSelections(storeRepo, orderRepo, [
      { ...makePreviewOrder({ email: "broken" }), selected: true },
    ]);

    expect(result).toEqual({ imported: 1, ignored: 0 });
    expect(orderRepo.created[0].status).toBe("NEEDS_REVIEW");
    expect(orderRepo.created[0].reviewReason).toContain("Email");
  });

  it("creates an unselected order as IGNORED with no validation", async () => {
    const storeRepo = new FakeStoreRepository([store]);
    const orderRepo = new FakeOrderRepository();

    const result = await confirmSyncSelections(storeRepo, orderRepo, [
      { ...makePreviewOrder({ email: "broken" }), selected: false },
    ]);

    expect(result).toEqual({ imported: 0, ignored: 1 });
    expect(orderRepo.created[0].status).toBe("IGNORED");
    expect(orderRepo.created[0].reviewReason).toBeNull();
  });

  it("skips orders whose store no longer exists", async () => {
    const storeRepo = new FakeStoreRepository([]);
    const orderRepo = new FakeOrderRepository();

    const result = await confirmSyncSelections(storeRepo, orderRepo, [
      { ...makePreviewOrder(), selected: true },
    ]);

    expect(result).toEqual({ imported: 0, ignored: 0 });
    expect(orderRepo.created).toHaveLength(0);
  });
});
