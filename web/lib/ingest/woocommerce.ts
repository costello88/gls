import type { StoreConfig } from "./types";

export interface RawWooCommerceOrder {
  id: number;
  number: string;
  billing?: {
    first_name?: string;
    last_name?: string;
    email?: string;
    phone?: string;
  };
  shipping?: {
    first_name?: string;
    last_name?: string;
    address_1?: string;
    address_2?: string;
    city?: string;
    postcode?: string;
    country?: string;
  };
}

type WooCommerceStoreConfig = Extract<StoreConfig, { type: "WOOCOMMERCE" }>;

export async function fetchWooCommerceOrders(
  store: WooCommerceStoreConfig,
): Promise<RawWooCommerceOrder[]> {
  const auth = Buffer.from(`${store.wooConsumerKey}:${store.wooConsumerSecret}`).toString(
    "base64",
  );
  const orders: RawWooCommerceOrder[] = [];
  let page = 1;

  while (true) {
    const url = `${store.siteUrl}/wp-json/wc/v3/orders?status=processing&per_page=100&page=${page}`;
    const response = await fetch(url, {
      headers: { Authorization: `Basic ${auth}` },
    });
    const json = (await response.json()) as RawWooCommerceOrder[];
    if (json.length === 0) {
      break;
    }
    orders.push(...json);
    page += 1;
  }

  return orders;
}
