import { fetchShopifyOrders } from "./shopify";
import { fetchWooCommerceOrders } from "./woocommerce";
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from "./normalize";
import type { NormalizedOrderInput, OrderRepository, StoreConfig } from "./types";

export interface PreviewOrder extends NormalizedOrderInput {
  storeId: string;
  storeName: string;
  orderDate: string;
}

export async function previewStoreOrders(
  store: StoreConfig,
  storeName: string,
  repository: OrderRepository,
): Promise<PreviewOrder[]> {
  const results: PreviewOrder[] = [];

  if (store.type === "SHOPIFY") {
    const rawOrders = await fetchShopifyOrders(store);
    for (const raw of rawOrders) {
      const normalized = normalizeShopifyOrder(raw);
      if (await repository.exists(store.id, normalized.sourceOrderId)) continue;
      results.push({
        ...normalized,
        storeId: store.id,
        storeName,
        orderDate: raw.created_at ?? "",
      });
    }
  } else {
    const rawOrders = await fetchWooCommerceOrders(store);
    for (const raw of rawOrders) {
      const normalized = normalizeWooCommerceOrder(raw);
      if (await repository.exists(store.id, normalized.sourceOrderId)) continue;
      results.push({
        ...normalized,
        storeId: store.id,
        storeName,
        orderDate: raw.date_created ?? "",
      });
    }
  }

  return results;
}
