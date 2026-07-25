import type { StoreConfig } from "../ingest/types";
import type { StoreRecord } from "./types";

export function toStoreConfig(store: StoreRecord): StoreConfig {
  return store.type === "SHOPIFY"
    ? {
        id: store.id,
        type: "SHOPIFY",
        defaultWeightKg: store.defaultWeightKg,
        customerNo: store.customerNo,
        shopDomain: store.shopDomain ?? "",
        shopifyAccessToken: store.shopifyAccessToken ?? "",
      }
    : {
        id: store.id,
        type: "WOOCOMMERCE",
        defaultWeightKg: store.defaultWeightKg,
        customerNo: store.customerNo,
        siteUrl: store.siteUrl ?? "",
        wooConsumerKey: store.wooConsumerKey ?? "",
        wooConsumerSecret: store.wooConsumerSecret ?? "",
      };
}
