import { NextResponse } from "next/server";
import { previewStoreOrders, type PreviewOrder } from "../../../../lib/ingest/preview";
import { toStoreConfig } from "../../../../lib/dashboard/storeConfig";
import type { OrderRepository } from "../../../../lib/ingest/types";
import type { StoreRepository } from "../../../../lib/dashboard/types";

export async function handlePreviewSync(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const stores = await storeRepo.list();
  const orders: PreviewOrder[] = [];

  for (const store of stores) {
    const preview = await previewStoreOrders(toStoreConfig(store), store.name, orderRepo);
    orders.push(...preview);
  }

  return NextResponse.json({ orders });
}
