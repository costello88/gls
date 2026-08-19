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
  private printedAt = new Map<string, Date>();

  seed(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  seedPrintedAt(id: string, date: Date) {
    this.printedAt.set(id, date);
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
    this.printedAt.set(id, new Date());
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

  async deletePrintedBefore(cutoff: Date): Promise<number> {
    let count = 0;
    for (const [id, order] of this.orders) {
      if (order.status !== "PRINTED") continue;
      const printedTime = this.printedAt.get(id) ?? new Date(0);
      if (printedTime < cutoff) {
        this.orders.delete(id);
        count += 1;
      }
    }
    return count;
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
  it("syncs every store and reports the sync result per store", async () => {
    mockedSyncStore.mockResolvedValue({ new: 1, valid: 1, invalid: 0, ignored: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore, manualStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "auto-order", storeId: "store-1", status: "PENDING" }));
    orderRepo.seed(makeOrderRecord({ id: "manual-order", storeId: "store-2", status: "PENDING" }));

    const result = await runAutomatedSync(storeRepo, orderRepo);

    expect(mockedSyncStore).toHaveBeenCalledTimes(2);
    expect(result.stores.map((r) => r.storeId)).toEqual(["store-1", "store-2"]);
    expect(result.stores.every((r) => r.sync.new === 1)).toBe(true);
    // Automation no longer auto-prints -- there is no API that registers a
    // shipment into GLS Print&Ship, so printing always requires a manual
    // CSV export/import step. Orders stay PENDING until a person prints them.
    expect((await orderRepo.get("auto-order"))?.status).toBe("PENDING");
    expect((await orderRepo.get("manual-order"))?.status).toBe("PENDING");
  });

  it("also cleans up printed orders older than a day", async () => {
    mockedSyncStore.mockResolvedValue({ new: 0, valid: 0, invalid: 0, ignored: 0 });

    const storeRepo = new FakeStoreRepository([automatedStore]);
    const orderRepo = new FakeAutomationOrderRepository();
    orderRepo.seed(makeOrderRecord({ id: "old-printed", storeId: "store-1", status: "PRINTED" }));
    orderRepo.seedPrintedAt("old-printed", new Date(Date.now() - 2 * 24 * 60 * 60 * 1000));

    const result = await runAutomatedSync(storeRepo, orderRepo);

    expect(result.deletedOldOrders).toBe(1);
    expect(await orderRepo.get("old-printed")).toBeNull();
  });
});
