import { describe, expect, it } from "vitest";
import type {
  DashboardOrderRepository,
  OrderFilter,
  OrderRecord,
  StoreRecord,
  StoreRepository,
} from "../../../../lib/dashboard/types";
import {
  handleClearOrders,
  handleExportOrders,
  handleListOrders,
  handlePrintOrder,
  handleReviewOrder,
} from "../shared";

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

  async listPrintable(): Promise<OrderRecord[]> {
    throw new Error("not used");
  }

  async deleteAll(): Promise<void> {
    this.orders.clear();
  }

  async deletePrintedBefore(): Promise<number> {
    throw new Error("not used");
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

describe("handleListOrders", () => {
  it("returns orders filtered by status", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", status: "PENDING" }));
    repo.seed(makeOrderRecord({ id: "2", status: "NEEDS_REVIEW" }));

    const request = new Request("https://example.com/api/orders?status=PENDING");
    const response = await handleListOrders(request, repo);
    const body = (await response.json()) as { orders: OrderRecord[] };

    expect(response.status).toBe(200);
    expect(body.orders.map((o) => o.id)).toEqual(["1"]);
  });
});

describe("handleReviewOrder", () => {
  it("applies edits and returns the updated order", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(
      makeOrderRecord({
        id: "1",
        status: "NEEDS_REVIEW",
        email: "kapot",
        reviewReason: "Email: ongeldig of ontbrekend",
      }),
    );

    const request = new Request("https://example.com/api/orders/1", {
      method: "PATCH",
      body: JSON.stringify({ email: "jan@voorbeeld.be" }),
    });
    const response = await handleReviewOrder(request, repo, "1");
    const body = (await response.json()) as { order: OrderRecord };

    expect(response.status).toBe(200);
    expect(body.order.status).toBe("PENDING");
  });
});

describe("handlePrintOrder", () => {
  it("returns a CSV file and marks the order PRINTED", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const storeRepo = new FakeStoreRepository();

    const response = await handlePrintOrder(repo, storeRepo, "1");
    const body = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/csv");
    expect(body).toContain("Jan Peeters");
    expect(body).toContain("11850079");
    expect((await repo.get("1"))?.status).toBe("PRINTED");
  });

  it("returns a 500 when the order doesn't exist", async () => {
    const repo = new FakeDashboardOrderRepository();
    const storeRepo = new FakeStoreRepository();

    const response = await handlePrintOrder(repo, storeRepo, "missing");
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(500);
    expect(body.error).toContain("missing");
  });
});

describe("handleExportOrders", () => {
  it("returns a combined CSV for every requested order and marks them PRINTED", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", name: "Jan Peeters" }));
    repo.seed(makeOrderRecord({ id: "2", name: "Marie Dubois" }));
    const storeRepo = new FakeStoreRepository();

    const request = new Request("https://example.com/api/orders/export-csv", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "2"] }),
    });
    const response = await handleExportOrders(request, repo, storeRepo);
    const body = await response.text();

    expect(response.headers.get("X-Failed-Ids")).toBe("");
    expect(body).toContain("Jan Peeters");
    expect(body).toContain("Marie Dubois");
    expect((await repo.get("1"))?.status).toBe("PRINTED");
    expect((await repo.get("2"))?.status).toBe("PRINTED");
  });

  it("skips orders that fail and reports them in X-Failed-Ids", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1", name: "Jan Peeters" }));
    const storeRepo = new FakeStoreRepository();

    const request = new Request("https://example.com/api/orders/export-csv", {
      method: "POST",
      body: JSON.stringify({ ids: ["1", "missing"] }),
    });
    const response = await handleExportOrders(request, repo, storeRepo);
    const body = await response.text();

    expect(response.headers.get("X-Failed-Ids")).toBe("missing");
    expect(body).toContain("Jan Peeters");
  });
});

describe("handleClearOrders", () => {
  it("deletes every order and returns ok", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));

    const response = await handleClearOrders(repo);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(await repo.list({})).toHaveLength(0);
  });
});
