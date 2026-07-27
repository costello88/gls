import { fulfillShopifyOrder } from "./shopify";
import { fulfillWooCommerceOrder } from "./woocommerce";
import type { StoreConfig } from "./types";

export async function fulfillOrder(
  store: StoreConfig,
  sourceOrderId: string,
  trackingNumber: string,
): Promise<void> {
  if (store.type === "SHOPIFY") {
    await fulfillShopifyOrder(store, sourceOrderId, trackingNumber);
  } else {
    await fulfillWooCommerceOrder(store, sourceOrderId);
  }
}
