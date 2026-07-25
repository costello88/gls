import { NextResponse } from "next/server";
import { syncStore } from "../../../lib/ingest/sync";
import type { OrderRepository, StoreConfig, SyncResult } from "../../../lib/ingest/types";
import type { StoreRepository } from "../../../lib/dashboard/types";

export async function handleSync(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const stores = await storeRepo.list();
  const results: Record<string, SyncResult> = {};

  for (const store of stores) {
    const config: StoreConfig =
      store.type === "SHOPIFY"
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

    results[store.id] = await syncStore(config, orderRepo);
  }

  return NextResponse.json({ results });
}
