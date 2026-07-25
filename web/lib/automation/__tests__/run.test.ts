import { describe, expect, it, vi } from "vitest";

vi.mock("../../ingest/sync", () => ({
  syncStore: vi.fn(),
}));

import { syncStore } from "../../ingest/sync";
import { runAutomatedSync } from "../run";
import type { DashboardOrderRepository, OrderFilter, OrderRecord, StoreRecord, StoreRepository } from "../../dashboard/types";

const mockedSyncStore = vi.mocked(syncStore);

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

function makeOrderRecord(overrides: Partial<OrderRecord> = {}): OrderRecord {
  return {
    id: "order-1",
    storeId: "store-1",
    sourceOrderId: "1001",
    orderNumber: "#1001",
    name: "Jan Peeters",
    street: "Kerkstraat",
    houseNo: "12",
    zipCode: "2000",
    city: "Antwerpen",
    countryCode: "BE",
    phone: "+32470123456",
    email: "jan@voorbeeld.be",
    weightKg: 1.5,
    customerNo: "11850079",
    status: "PENDING",
    reviewReason: null,
    label: null,
    trackingLink: null,
    ...overrides,
  };
}

class FakeAutomationOrderRepository implements DashboardOrderRepository {
  private orders = new Map<string, OrderRecord>();

  seed(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  async exists(): Promise<boolean> {
    throw new Error("not used");
  }

  async create(): Promise<void> {
    throw new Error("not used");
  }

  async list(filter: OrderFilter): Promise<OrderRecord[]> {
    return [...this.orders.values()].filter(
      (order) => !filter.status || order.status === filter.status,
    );
  }

  async get(id: string): Promise<OrderRecord | null> {
    return this.orders.get(id) ?? null;
  }

  async update(id: string, fields: Partial<OrderRecord>): Promise<OrderRecord> {
    const existing = this.orders.get(id);
    if (!existing) throw new Error(`Order ${id} not found`);
    const updated = { ...existing, ...fields };
    this.orders.set(id, updated);
    return updated;
  }

  async markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord> {
    return this.update(id, { status: "PRINTED", label, trackingLink });
  }

  async markError(id: string, message: string): Promise<OrderRecord> {
    return this.update(id, { status: "ERROR", reviewReason: message });
  }

  async listPrintable(storeIds: string[]): Promise<OrderRecord[]> {
    return [...this.orders.values()].filter(
      (order) =>
        storeIds.includes(order.storeId) && (order.status === "PENDING" || order.status === "ERROR"),
    );
  }

  async deleteAll(): Promise<void> {
    this.orders.clear();
  }
}

const automatedStore: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: true,
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

const manualStore: StoreRecord = {
  ...automatedStore,
  id: "store-2",
  name: "Manual Store",
  automationEnabled: false,
};

describe("runAutomatedSync", () => {
  it("syncs every store and only auto-prints for automation-enabled stores", async () => {
    mockedSyncStore.mockResolvedValue({ new: 1, valid: 1, invalid: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore, manualStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "auto-order", storeId: "store-1", status: "PENDING" }));
    orderRepo.seed(makeOrderRecord({ id: "manual-order", storeId: "store-2", status: "PENDING" }));

    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });

    const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);

    expect(mockedSyncStore).toHaveBeenCalledTimes(2);
    expect(createLabelFn).toHaveBeenCalledTimes(1);

    const autoResult = results.find((r) => r.storeId === "store-1");
    expect(autoResult?.printed).toBe(1);
    expect(autoResult?.failed).toBe(0);
    expect((await orderRepo.get("auto-order"))?.status).toBe("PRINTED");
    expect((await orderRepo.get("manual-order"))?.status).toBe("PENDING");
  });

  it("counts failed auto-prints and leaves the order in ERROR for the next cycle to retry", async () => {
    mockedSyncStore.mockResolvedValue({ new: 0, valid: 0, invalid: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "failing-order", storeId: "store-1", status: "ERROR" }));

    const createLabelFn = vi.fn().mockRejectedValue(new Error("GLS unavailable"));

    const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);

    const result = results.find((r) => r.storeId === "store-1");
    expect(result?.printed).toBe(0);
    expect(result?.failed).toBe(1);
    expect((await orderRepo.get("failing-order"))?.status).toBe("ERROR");
  });
});
