import { NextResponse } from "next/server";
import { syncStore } from "../../../lib/ingest/sync";
import { toStoreConfig } from "../../../lib/dashboard/storeConfig";
import type { OrderRepository, SyncResult } from "../../../lib/ingest/types";
import type { StoreRepository } from "../../../lib/dashboard/types";

export async function handleSync(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const stores = await storeRepo.list();
  const results: Record<string, SyncResult> = {};

  for (const store of stores) {
    results[store.id] = await syncStore(toStoreConfig(store), orderRepo);
  }

  return NextResponse.json({ results });
}
