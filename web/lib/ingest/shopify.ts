import type { StoreConfig } from "./types";

const API_VERSION = "2024-10";
const NEXT_LINK_RE = /<([^>]+)>;\s*rel="next"/;

export interface RawShopifyOrder {
  id: number;
  name: string;
  contact_email?: string;
  customer?: { email?: string; phone?: string };
  shipping_address?: {
    name?: string;
    address1?: string;
    address2?: string;
    zip?: string;
    city?: string;
    country_code?: string;
    phone?: string;
  };
}

type ShopifyStoreConfig = Extract<StoreConfig, { type: "SHOPIFY" }>;

export async function fetchShopifyOrders(store: ShopifyStoreConfig): Promise<RawShopifyOrder[]> {
  let url: string | null = `https://${store.shopDomain}/admin/api/${API_VERSION}/orders.json`;
  let params: URLSearchParams | null = new URLSearchParams({
    financial_status: "paid",
    fulfillment_status: "unfulfilled",
    status: "any",
    limit: "250",
  });

  const orders: RawShopifyOrder[] = [];
  while (url) {
    const requestUrl: string = params ? `${url}?${params.toString()}` : url;
    const response = await fetch(requestUrl, {
      headers: { "X-Shopify-Access-Token": store.shopifyAccessToken },
    });
    const json = (await response.json()) as { orders?: RawShopifyOrder[] };
    orders.push(...(json.orders ?? []));

    const link = response.headers.get("Link") ?? "";
    const match = link.match(NEXT_LINK_RE);
    url = match ? match[1] : null;
    params = null;
  }

  return orders;
}
