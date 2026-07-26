import { checkOrder } from "../validate";
import type { PreviewOrder } from "../ingest/preview";
import type { OrderRepository } from "../ingest/types";
import type { StoreRepository } from "./types";

export interface ConfirmSyncResult {
  imported: number;
  ignored: number;
}

export async function confirmSyncSelections(
  storeRepo: StoreRepository,
  orderRepo: OrderRepository,
  orders: (PreviewOrder & { selected: boolean })[],
): Promise<ConfirmSyncResult> {
  let imported = 0;
  let ignored = 0;

  for (const order of orders) {
    const store = await storeRepo.get(order.storeId);
    if (!store) continue;

    const reasons = order.selected
      ? checkOrder({ email: order.email, phone: order.phone, countryCode: order.countryCode })
      : [];
    const status = !order.selected ? "IGNORED" : reasons.length > 0 ? "NEEDS_REVIEW" : "PENDING";

    await orderRepo.create({
      storeId: order.storeId,
      sourceOrderId: order.sourceOrderId,
      orderNumber: order.orderNumber,
      name: order.name,
      street: order.street,
      houseNo: order.houseNo,
      zipCode: order.zipCode,
      city: order.city,
      countryCode: order.countryCode,
      phone: order.phone,
      email: order.email,
      weightKg: store.defaultWeightKg,
      customerNo: store.customerNo,
      status,
      reviewReason: status === "NEEDS_REVIEW" ? reasons.join("; ") : null,
    });

    if (order.selected) {
      imported += 1;
    } else {
      ignored += 1;
    }
  }

  return { imported, ignored };
}
