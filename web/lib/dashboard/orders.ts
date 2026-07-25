import { checkOrder } from "../validate";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "../gls/types";
import type { DashboardOrderRepository, OrderEdits, OrderFilter, OrderRecord } from "./types";

export type CreateLabelFn = (
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
) => Promise<CreateLabelResult>;

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

  const merged = { ...existing, ...edits };
  const reasons = checkOrder({
    email: merged.email,
    phone: merged.phone,
    countryCode: merged.countryCode,
  });

  return repo.update(id, {
    ...edits,
    status: reasons.length > 0 ? "NEEDS_REVIEW" : "PENDING",
    reviewReason: reasons.length > 0 ? reasons.join("; ") : null,
  });
}

export async function printOrder(
  repo: DashboardOrderRepository,
  id: string,
  createLabelFn: CreateLabelFn,
): Promise<{ label: string; trackingLink: string }> {
  const order = await repo.get(id);
  if (!order) {
    throw new Error(`Order ${id} not found`);
  }

  try {
    const result = await createLabelFn(
      {
        name: order.name,
        street: order.street,
        houseNo: order.houseNo,
        zipCode: order.zipCode,
        city: order.city,
        countryCode: order.countryCode as "BE" | "NL" | "LU",
        phone: order.phone,
        email: order.email,
        weightKg: order.weightKg,
        reference: order.orderNumber,
      },
      "pdf",
      order.customerNo,
    );

    await repo.markPrinted(id, result.label, result.trackingLink);
    return { label: result.label, trackingLink: result.trackingLink };
  } catch (err) {
    await repo.markError(id, (err as Error).message);
    throw err;
  }
}
