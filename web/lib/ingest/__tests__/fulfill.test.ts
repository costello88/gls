import { afterEach, describe, expect, it, vi } from "vitest";
import { fulfillShopifyOrder } from "../shopify";
import { fulfillWooCommerceOrder } from "../woocommerce";
import { fulfillOrder } from "../fulfill";
import type { StoreConfig } from "../types";

const shopifyStore: StoreConfig = {
  id: "store-1",
  type: "SHOPIFY",
  defaultWeightKg: 1.5,
  customerNo: "11850079",
  shopDomain: "example.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

const wooStore: StoreConfig = {
  id: "store-2",
  type: "WOOCOMMERCE",
  defaultWeightKg: 1.0,
  customerNo: "11850080",
  siteUrl: "https://example.com",
  wooConsumerKey: "ck_test",
  wooConsumerSecret: "cs_test",
};

describe("fulfillShopifyOrder", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("fetches the open fulfillment order and posts a fulfillment with tracking info", async () => {
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        json: async () => ({ fulfillment_orders: [{ id: 555, status: "open" }] }),
      })
      .mockResolvedValueOnce({ json: async () => ({}) });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fulfillShopifyOrder(shopifyStore, "1001", "11850080202728");

    expect(mockFetch).toHaveBeenCalledTimes(2);
    expect(mockFetch.mock.calls[0][0]).toBe(
      "https://example.myshopify.com/admin/api/2024-10/orders/1001/fulfillment_orders.json",
    );
    const [url, options] = mockFetch.mock.calls[1];
    expect(url).toBe("https://example.myshopify.com/admin/api/2024-10/fulfillments.json");
    expect(options.method).toBe("POST");
    const body = JSON.parse(options.body);
    expect(body.fulfillment.line_items_by_fulfillment_order).toEqual([{ fulfillment_order_id: 555 }]);
    expect(body.fulfillment.tracking_info).toEqual({ number: "11850080202728", company: "GLS" });
  });

  it("does nothing if there is no open fulfillment order", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      json: async () => ({ fulfillment_orders: [{ id: 555, status: "closed" }] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fulfillShopifyOrder(shopifyStore, "1001", "11850080202728");

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});

describe("fulfillWooCommerceOrder", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("sets the order status to completed", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: async () => ({}) });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fulfillWooCommerceOrder(wooStore, "2001");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/wp-json/wc/v3/orders/2001");
    expect(options.method).toBe("PUT");
    expect(JSON.parse(options.body)).toEqual({ status: "completed" });
  });
});

describe("fulfillOrder", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it("dispatches to fulfillShopifyOrder for SHOPIFY stores", async () => {
    const mockFetch = vi.fn().mockResolvedValueOnce({
      json: async () => ({ fulfillment_orders: [] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fulfillOrder(shopifyStore, "1001", "11850080202728");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch.mock.calls[0][0]).toContain("/fulfillment_orders.json");
  });

  it("dispatches to fulfillWooCommerceOrder for WOOCOMMERCE stores", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ json: async () => ({}) });
    global.fetch = mockFetch as unknown as typeof fetch;

    await fulfillOrder(wooStore, "2001", "11850080202728");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url] = mockFetch.mock.calls[0];
    expect(url).toBe("https://example.com/wp-json/wc/v3/orders/2001");
  });
});
