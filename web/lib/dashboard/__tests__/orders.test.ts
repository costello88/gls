import { describe, expect, it } from "vitest";
import { cleanupOldOrders, clearOrders, exportOrders, listOrders, printOrder, reviewOrder } from "../orders";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
  StoreRecord,
  StoreRepository,
} from "../types";

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

class FakeDashboardOrderRepository implements DashboardOrderRepository {
  private orders = new Map<string, OrderRecord>();
  private printedAt = new Map<string, Date>();

  seed(order: OrderRecord) {
    this.orders.set(order.id, order);
  }

  seedPrintedAt(id: string, date: Date) {
    this.printedAt.set(id, date);
  }

  async exists(): Promise<boolean> {
    throw new Error("not used in these tests");
  }

  async create(): Promise<void> {
    throw new Error("not used in these tests");
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

  async listPrintable(): Promise<OrderRecord[]> {
    throw new Error("not used in these tests");
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

class FakeStoreRepository implements StoreRepository {
  constructor(private stores: StoreRecord[] = [store]) {}

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

describe("listOrders", () => {
  it("filters by status", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "NEEDS_REVIEW" }));

    const result = await listOrders(repo, { status: "PENDING" });

    expect(result.map((o) => o.id)).toEqual(["1"]);
  });
});

describe("reviewOrder", () => {
  it("moves a fixed order back to PENDING", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        reviewReason: "Email: ongeldig of ontbrekend",
        email: "kapot",
      }),
    );

    const edits: OrderEdits = { email: "jan@voorbeeld.be" };
    const result = await reviewOrder(repo, "1", edits);

    expect(result.status).toBe("PENDING");
    expect(result.reviewReason).toBeNull();
    expect(result.email).toBe("jan@voorbeeld.be");
  });

  it("moves to PENDING even when the edited fields are still invalid", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        reviewReason: "Email: ongeldig of ontbrekend",
        email: "kapot",
      }),
    );

    const result = await reviewOrder(repo, "1", { email: "nog steeds kapot" });

    expect(result.status).toBe("PENDING");
    expect(result.reviewReason).toBeNull();
  });

  it("moves to PENDING even with no edits at all (skip)", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        reviewReason: "Email: ongeldig of ontbrekend",
        email: "kapot",
      }),
    );

    const result = await reviewOrder(repo, "1", {});

    expect(result.status).toBe("PENDING");
    expect(result.reviewReason).toBeNull();
    expect(result.email).toBe("kapot");
  });
});

describe("printOrder", () => {
  it("builds a GLS import CSV for the order and marks it PRINTED", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const storeRepo = new FakeStoreRepository();

    const result = await printOrder(repo, storeRepo, "1");

    expect(result.csv).toContain("Jan Peeters");
    expect(result.csv).toContain("11850079");
    const updated = await repo.get("1");
    expect(updated?.status).toBe("PRINTED");
    expect(updated?.label).toBe("");
    expect(updated?.trackingLink).toBe("");
  });

  it("throws when the order doesn't exist", async () => {
    const repo = new FakeDashboardOrderRepository();
    const storeRepo = new FakeStoreRepository();

    await expect(printOrder(repo, storeRepo, "missing")).rejects.toThrow("missing");
  });

  it("throws when the order's store doesn't exist", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", storeId: "missing-store" }));
    const storeRepo = new FakeStoreRepository();

    await expect(printOrder(repo, storeRepo, "1")).rejects.toThrow("missing-store");
  });
});

describe("exportOrders", () => {
  it("builds one combined CSV for every order and marks them all PRINTED", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", name: "Jan Peeters" }));
    repo.seed(makeOrderRecord({ id: "2", name: "Marie Dubois" }));
    const storeRepo = new FakeStoreRepository();

    const result = await exportOrders(repo, storeRepo, ["1", "2"]);

    expect(result.failed).toEqual([]);
    expect(result.csv).toContain("Jan Peeters");
    expect(result.csv).toContain("Marie Dubois");
    expect((await repo.get("1"))?.status).toBe("PRINTED");
    expect((await repo.get("2"))?.status).toBe("PRINTED");
  });

  it("skips orders that fail and still exports the rest", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", name: "Jan Peeters" }));
    const storeRepo = new FakeStoreRepository();

    const result = await exportOrders(repo, storeRepo, ["1", "missing"]);

    expect(result.failed).toEqual(["missing"]);
    expect(result.csv).toContain("Jan Peeters");
  });
});

describe("clearOrders", () => {
  it("deletes every order", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "PRINTED" }));

    await clearOrders(repo);

    expect(await listOrders(repo, {})).toHaveLength(0);
  });
});

describe("cleanupOldOrders", () => {
  it("deletes printed orders older than a day and leaves everything else", async () => {
    const repo = new FakeDashboardOrderRepository();
    const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
    repo.seed(makeOrderRecord({ id: "old-printed", status: "PRINTED" }));
    repo.seedPrintedAt("old-printed", twoDaysAgo);
    repo.seed(makeOrderRecord({ id: "recent-printed", status: "PRINTED" }));
    repo.seedPrintedAt("recent-printed", new Date());
    repo.seed(makeOrderRecord({ id: "pending", status: "PENDING" }));

    const deleted = await cleanupOldOrders(repo);

    expect(deleted).toBe(1);
    expect(await repo.get("old-printed")).toBeNull();
    expect(await repo.get("recent-printed")).not.toBeNull();
    expect(await repo.get("pending")).not.toBeNull();
  });
});
