import { syncStore } from "../ingest/sync";
import { cleanupOldOrders } from "../dashboard/orders";
import { toStoreConfig } from "../dashboard/storeConfig";
import type { DashboardOrderRepository, StoreRepository } from "../dashboard/types";
import type { SyncResult } from "../ingest/types";

export interface AutomationStoreResult {
  storeId: string;
  sync: SyncResult;
}

export interface AutomationResult {
  stores: AutomationStoreResult[];
  deletedOldOrders: number;
}

// Printing now happens by exporting a CSV for manual import into GLS Print&Ship
// (there is no API that registers a shipment into Print&Ship's own shipment
// list), so automation is limited to syncing orders -- printing always
// requires a person to download and import the CSV. Orders printed more
// than a day ago are also cleaned up here so they don't keep piling up on
// days nobody imports the CSV.
export async function runAutomatedSync(
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
): Promise<AutomationResult> {
  const stores = await storeRepo.list();
  const results: AutomationStoreResult[] = [];

  for (const store of stores) {
    const sync = await syncStore(toStoreConfig(store), orderRepo);
    results.push({ storeId: store.id, sync });
  }

  const deletedOldOrders = await cleanupOldOrders(orderRepo);

  return { stores: results, deletedOldOrders };
}
