import { buildGlsImportCsv } from "../gls/importCsv";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
  StoreRepository,
} from "./types";

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
    } catch {
      failed.push(id);
    }
  }

  return { csv: buildGlsImportCsv(rows), failed };
}

export async function clearOrders(repo: DashboardOrderRepository): Promise<void> {
  await repo.deleteAll();
}
