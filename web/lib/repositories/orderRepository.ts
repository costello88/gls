import { prisma } from "../db";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
} from "../dashboard/types";
import type { OrderRecordInput } from "../ingest/types";

interface PrismaOrderRow {
  id: string;
  storeId: string;
  sourceOrderId: string;
  orderNumber: string;
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  weightKg: number;
  customerNo: string;
  status: string;
  reviewReason: string | null;
  label: string | null;
  trackingLink: string | null;
}

function toOrderRecord(order: PrismaOrderRow): OrderRecord {
  return { ...order, status: order.status as OrderRecord["status"] };
}

export class PrismaOrderRepository implements DashboardOrderRepository {
  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    const count = await prisma.order.count({ where: { storeId, sourceOrderId } });
    return count > 0;
  }

  async create(
    order: OrderRecordInput & {
      storeId: string;
      weightKg: number;
      customerNo: string;
      status: string;
      reviewReason: string | null;
    },
  ): Promise<void> {
    await prisma.order.create({ data: order });
  }

  async list(filter: OrderFilter): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: filter.status ? { status: filter.status } : undefined,
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrderRecord);
  }

  async get(id: string): Promise<OrderRecord | null> {
    const order = await prisma.order.findUnique({ where: { id } });
    return order ? toOrderRecord(order) : null;
  }

  async update(
    id: string,
    fields: OrderEdits & { status: "PENDING" | "NEEDS_REVIEW"; reviewReason: string | null },
  ): Promise<OrderRecord> {
    const order = await prisma.order.update({ where: { id }, data: fields });
    return toOrderRecord(order);
  }

  async markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord> {
    const order = await prisma.order.update({
      where: { id },
      data: { status: "PRINTED", label, trackingLink },
    });
    return toOrderRecord(order);
  }

  async markError(id: string, message: string): Promise<OrderRecord> {
    const order = await prisma.order.update({
      where: { id },
      data: { status: "ERROR", reviewReason: message },
    });
    return toOrderRecord(order);
  }
}
