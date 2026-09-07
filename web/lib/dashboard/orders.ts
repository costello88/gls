import { buildGlsImportCsv } from "../gls/importCsv";
import { fulfillOrder } from "../ingest/fulfill";
import { usesFulfillmentWorkflow } from "./fulfillmentPolicy";
import { toStoreConfig } from "./storeConfig";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
  ProcessedOrderEntry,
  ProcessedReason,
  StoreRepository,
} from "./types";

function toProcessedEntry(order: OrderRecord, reason: ProcessedReason): ProcessedOrderEntry {
  return {
    storeId: order.storeId,
    sourceOrderId: order.sourceOrderId,
    orderNumber: order.orderNumber,
    name: order.name,
    reason,
  };
}

export async function listOrders(
  repo: DashboardOrderRepository,
  filter: OrderFilter,
): Promise<OrderRecord[]> {
  return repo.list(filter);
}

export async function reviewOrder(
  repo: DashboardOrderRepository,
  id: string,
  edits: OrderEdits,
): Promise<OrderRecord> {
  const existing = await repo.get(id);
  if (!existing) {
    throw new Error(`Order ${id} not found`);
  }

  return repo.update(id, {
    ...edits,
    status: "PENDING",
    reviewReason: null,
  });
}

// Marks the order fulfilled/completed at the source store so future syncs
// don't keep re-fetching it as unfulfilled/processing -- without this,
// exported orders that later get cleaned up locally (see cleanupOldOrders)
// would resurrect as "new" on the next sync since the source never learned
// they were handled. Non-fatal: a failed write-back must never block the
// CSV export or revert the order's PRINTED status.
async function markSourceFulfilled(storeRepo: StoreRepository, order: OrderRecord): Promise<void> {
  try {
    const store = await storeRepo.get(order.storeId);
    if (store && usesFulfillmentWorkflow(store)) {
      await fulfillOrder(toStoreConfig(store), order.sourceOrderId);
    }
  } catch {
    // ignore -- see comment above
  }
}

export async function printOrder(
  repo: DashboardOrderRepository,
  storeRepo: StoreRepository,
  id: string,
): Promise<{ csv: string }> {
  const order = await repo.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }

  const store = await storeRepo.get(order.storeId);
  if (!store) {
    throw new Error(`Store ${order.storeId} not found`);
  }

  const csv = buildGlsImportCsv([{ ...order, senderNumber: store.customerNo }]);
  await repo.markPrinted(id, "", "");
  await repo.recordProcessed([toProcessedEntry(order, "EXPORTED")]);
  await markSourceFulfilled(storeRepo, order);
  return { csv };
}

export async function exportOrders(
  repo: DashboardOrderRepository,
  storeRepo: StoreRepository,
  ids: string[],
): Promise<{ csv: string; failed: string[] }> {
  const rows: Parameters<typeof buildGlsImportCsv>[0] = [];
  const failed: string[] = [];

  for (const id of ids) {
    try {
      const order = await repo.get(id);
      if (!order) {
        throw new Error(`Order ${id} not found`);
      }
      const store = await storeRepo.get(order.storeId);
      if (!store) {
        throw new Error(`Store ${order.storeId} not found`);
      }
      rows.push({ ...order, senderNumber: store.customerNo });
      await repo.markPrinted(id, "", "");
      await repo.recordProcessed([toProcessedEntry(order, "EXPORTED")]);
      await markSourceFulfilled(storeRepo, order);
    } catch {
      failed.push(id);
    }
  }

  return { csv: buildGlsImportCsv(rows), failed };
}

// Removes orders from the working list without exporting them, and records
// them as handled so a sync never pulls them back in. For orders that were
// already shipped some other way, or that should simply never be processed.
export async function dismissOrders(
  repo: DashboardOrderRepository,
  ids: string[],
): Promise<number> {
  const entries: ProcessedOrderEntry[] = [];

  for (const id of ids) {
    const order = await repo.get(id);
    if (order) {
      entries.push(toProcessedEntry(order, "DISMISSED"));
    }
  }

  await repo.recordProcessed(entries);
  await repo.deleteByIds(ids);
  return entries.length;
}

export async function clearOrders(repo: DashboardOrderRepository): Promise<void> {
  await repo.deleteAll();
}

const PRINTED_ORDER_RETENTION_DAYS = 1;

// Printed orders are only ever needed again to re-download their CSV, so
// they're removed a day after printing -- otherwise they'd keep piling up in
// the "Geprint" tab every day the CSV isn't imported into GLS. Safe to delete
// for every store: the permanent processed-order ledger, not this row, is
// what stops a re-sync from importing them again.
export async function cleanupOldOrders(repo: DashboardOrderRepository): Promise<number> {
  const cutoff = new Date(Date.now() - PRINTED_ORDER_RETENTION_DAYS * 24 * 60 * 60 * 1000);
  return repo.deletePrintedBefore(cutoff);
}
