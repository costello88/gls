import { describe, expect, it, vi } from "vitest";
import { GlsApiError } from "../../../../lib/gls/errors";
import type { DashboardOrderRepository, OrderFilter, OrderRecord } from "../../../../lib/dashboard/types";
import { handleListOrders, handlePrintOrder, handleReviewOrder } from "../shared";

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
  it("returns the label on success", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockResolvedValue({
      label: "base64-label",
      trackingLink: "https://track.gls/1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });

    const response = await handlePrintOrder(repo, "1", createLabelFn);
    const body = (await response.json()) as { label: string; trackingLink: string };

    expect(response.status).toBe(200);
    expect(body.label).toBe("base64-label");
  });

  it("returns a 502 with the GLS error message on failure", async () => {
    const repo = new FakeDashboardOrderRepository();
    repo.seed(makeOrderRecord({ id: "1" }));
    const createLabelFn = vi.fn().mockRejectedValue(new GlsApiError("Ongeldige postcode", 422));

    const response = await handlePrintOrder(repo, "1", createLabelFn);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(502);
    expect(body.error).toBe("Ongeldige postcode");
  });
});
