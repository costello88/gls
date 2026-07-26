import { NextResponse } from "next/server";
import { confirmSyncSelections } from "../../../../lib/dashboard/confirmSync";
import type { PreviewOrder } from "../../../../lib/ingest/preview";
import type { OrderRepository } from "../../../../lib/ingest/types";
import type { StoreRepository } from "../../../../lib/dashboard/types";

export async function handleConfirmSync(
  request: Request,
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
): Promise<Response> {
  const { orders } = (await request.json()) as {
    orders: (PreviewOrder & { selected: boolean })[];
  };
  const result = await confirmSyncSelections(storeRepo, orderRepo, orders);
  return NextResponse.json(result);
}
