import { syncStore } from "../ingest/sync";
import { printOrder, type CreateLabelFn } from "../dashboard/orders";
import { toStoreConfig } from "../dashboard/storeConfig";
import type { DashboardOrderRepository, StoreRepository } from "../dashboard/types";
import type { SyncResult } from "../ingest/types";

export interface AutomationStoreResult {
  storeId: string;
  sync: SyncResult;
  printed: number;
  failed: number;
}

export async function runAutomatedSync(
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
  createLabelFn: CreateLabelFn,
): Promise<AutomationStoreResult[]> {
  const stores = await storeRepo.list();
  const results: AutomationStoreResult[] = [];

  for (const store of stores) {
    const sync = await syncStore(toStoreConfig(store), orderRepo);
    results.push({ storeId: store.id, sync, printed: 0, failed: 0 });
  }

  const automatedStoreIds = stores.filter((store) => store.automationEnabled).map((store) => store.id);

  if (automatedStoreIds.length > 0) {
    const printable = await orderRepo.listPrintable(automatedStoreIds);
    for (const order of printable) {
      const result = results.find((r) => r.storeId === order.storeId);
      if (!result) continue;
      try {
        await printOrder(orderRepo, storeRepo, order.id, createLabelFn);
        result.printed += 1;
      } catch {
        result.failed += 1;
      }
    }
  }

  return results;
}
