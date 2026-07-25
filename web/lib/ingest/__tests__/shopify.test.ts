import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchShopifyOrders } from "../shopify";

describe("fetchShopifyOrders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const store = {
    id: "store-1",
    type: "SHOPIFY" as const,
    defaultWeightKg: 1.0,
    customerNo: "11850079",
    shopDomain: "example.myshopify.com",
    shopifyAccessToken: "shpat_test",
  };

  it("fetches a single page and sends the access token header", async () => {
    const order = { id: 1001, name: "#1001" };
    const mockFetch = vi.fn().mockResolvedValue({
      headers: new Headers(),
      json: async () => ({ orders: [order] }),
    });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchShopifyOrders(store);

    expect(orders).toEqual([order]);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toContain("https://example.myshopify.com/admin/api/2024-10/orders.json");
    expect(url).toContain("financial_status=paid");
    expect(url).toContain("fulfillment_status=unfulfilled");
    expect((options as RequestInit).headers).toEqual({
      "X-Shopify-Access-Token": "shpat_test",
    });
  });

  it("follows the Link header for pagination", async () => {
    const order1 = { id: 1001, name: "#1001" };
    const order2 = { id: 1002, name: "#1002" };
    const nextUrl = "https://example.myshopify.com/admin/api/2024-10/orders.json?page_info=abc";

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({
        headers: new Headers({ Link: `<${nextUrl}>; rel="next"` }),
        json: async () => ({ orders: [order1] }),
      })
      .mockResolvedValueOnce({
        headers: new Headers(),
        json: async () => ({ orders: [order2] }),
      });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchShopifyOrders(store);

    expect(orders.map((o) => o.id)).toEqual([1001, 1002]);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });
});
