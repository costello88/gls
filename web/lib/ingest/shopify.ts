import type { StoreConfig } from "./types";

const API_VERSION = "2024-10";
const NEXT_LINK_RE = /<([^>]+)>;\s*rel="next"/;

export interface RawShopifyOrder {
  id: number;
  name: string;
  created_at?: string;
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

interface FulfillmentOrder {
  id: number;
  status: string;
}

export async function fulfillShopifyOrder(
  store: ShopifyStoreConfig,
  sourceOrderId: string,
  trackingNumber: string,
): Promise<void> {
  const headers = {
    "X-Shopify-Access-Token": store.shopifyAccessToken,
    "Content-Type": "application/json",
  };

  const fulfillmentOrdersResponse = await fetch(
    `https://${store.shopDomain}/admin/api/${API_VERSION}/orders/${sourceOrderId}/fulfillment_orders.json`,
    { headers },
  );
  const fulfillmentOrdersJson = (await fulfillmentOrdersResponse.json()) as {
    fulfillment_orders?: FulfillmentOrder[];
  };
  const openFulfillmentOrder = fulfillmentOrdersJson.fulfillment_orders?.find(
    (fulfillmentOrder) => fulfillmentOrder.status === "open" || fulfillmentOrder.status === "in_progress",
  );
  if (!openFulfillmentOrder) {
    return;
  }

  await fetch(`https://${store.shopDomain}/admin/api/${API_VERSION}/fulfillments.json`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      fulfillment: {
        line_items_by_fulfillment_order: [{ fulfillment_order_id: openFulfillmentOrder.id }],
        tracking_info: { number: trackingNumber, company: "GLS" },
        notify_customer: true,
      },
    }),
  });
}
