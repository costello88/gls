import { afterEach, describe, expect, it, vi } from "vitest";
import { GlsApiError } from "../../gls/errors";
import { clearOrders, listOrders, printOrder, reviewOrder } from "../orders";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
  StoreRecord,
  StoreRepository,
} from "../types";

vi.mock("../../ingest/fulfill", () => ({
  fulfillOrder: vi.fn().mockResolvedValue(undefined),
}));

import { fulfillOrder } from "../../ingest/fulfill";

const mockedFulfillOrder = vi.mocked(fulfillOrder);

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
  afterEach(() => {
    mockedFulfillOrder.mockClear();
  });

  it("marks the order PRINTED on success", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const storeRepo = new FakeStoreRepository();
    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
      unitNo: "11850080202728",
    });

    const result = await printOrder(repo, storeRepo, "1", createLabelFn);

    expect(result).toEqual({ label: "base64-label", trackingLink: "https://track.gls/1" });
    const updated = await repo.get("1");
    expect(updated?.status).toBe("PRINTED");
    expect(createLabelFn).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Jan Peeters", reference: "#1001" }),
      "pdf",
      "11850079",
    );
    expect(mockedFulfillOrder).toHaveBeenCalledWith(
      expect.objectContaining({ id: "store-1", type: "SHOPIFY" }),
      "1001",
      "11850080202728",
    );
  });

  it("still marks the order PRINTED even if the fulfillment write-back fails", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const storeRepo = new FakeStoreRepository();
    mockedFulfillOrder.mockRejectedValueOnce(new Error("Shopify unavailable"));
    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
      unitNo: "11850080202728",
    });

    const result = await printOrder(repo, storeRepo, "1", createLabelFn);

    expect(result.label).toBe("base64-label");
    const updated = await repo.get("1");
    expect(updated?.status).toBe("PRINTED");
  });

  it("marks the order ERROR and rethrows on failure", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const storeRepo = new FakeStoreRepository();
    const createLabelFn = vi.fn().mockRejectedValue(new GlsApiError("Ongeldige postcode", 422));

    await expect(printOrder(repo, storeRepo, "1", createLabelFn)).rejects.toThrow("Ongeldige postcode");

    const updated = await repo.get("1");
    expect(updated?.status).toBe("ERROR");
    expect(updated?.reviewReason).toBe("Ongeldige postcode");
    expect(mockedFulfillOrder).not.toHaveBeenCalled();
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
