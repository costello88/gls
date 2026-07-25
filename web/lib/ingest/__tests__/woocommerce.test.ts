import { afterEach, describe, expect, it, vi } from "vitest";
import { fetchWooCommerceOrders } from "../woocommerce";

describe("fetchWooCommerceOrders", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  const store = {
    id: "store-2",
    type: "WOOCOMMERCE" as const,
    defaultWeightKg: 1.0,
    customerNo: "11850080",
    siteUrl: "https://example.com",
    wooConsumerKey: "ck_test",
    wooConsumerSecret: "cs_test",
  };

  it("fetches a single page with status=processing and a Basic auth header", async () => {
    const order = { id: 2001, number: "2001" };
    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [order] })
      .mockResolvedValueOnce({ json: async () => [] });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchWooCommerceOrders(store);

    expect(orders).toEqual([order]);
    const [url, options] = mockFetch.mock.calls[0];
    expect(url).toBe(
      "https://example.com/wp-json/wc/v3/orders?status=processing&per_page=100&page=1",
    );
    const expectedAuth = `Basic ${Buffer.from("ck_test:cs_test").toString("base64")}`;
    expect((options as RequestInit).headers).toEqual({ Authorization: expectedAuth });
  });

  it("pages forward until an empty page is returned", async () => {
    const order1 = { id: 2001, number: "2001" };
    const order2 = { id: 2002, number: "2002" };

    const mockFetch = vi
      .fn()
      .mockResolvedValueOnce({ json: async () => [order1] })
      .mockResolvedValueOnce({ json: async () => [order2] })
      .mockResolvedValueOnce({ json: async () => [] });
    global.fetch = mockFetch as unknown as typeof fetch;

    const orders = await fetchWooCommerceOrders(store);

    expect(orders.map((o) => o.id)).toEqual([2001, 2002]);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(mockFetch.mock.calls[1][0]).toContain("page=2");
    expect(mockFetch.mock.calls[2][0]).toContain("page=3");
  });
});
