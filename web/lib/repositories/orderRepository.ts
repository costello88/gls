import { prisma } from "../db";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  OrderRecord,
  ProcessedOrderEntry,
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
  // "Have we ever seen this order before?" -- checks both the working list and
  // the permanent processed-order ledger, so an order that was exported and
  // later cleaned up locally is never re-imported.
  async exists(storeId: string, sourceOrderId: string): Promise<boolean> {
    const [openCount, processedCount] = await Promise.all([
      prisma.order.count({ where: { storeId, sourceOrderId } }),
      prisma.processedOrder.count({ where: { storeId, sourceOrderId } }),
    ]);
    return openCount > 0 || processedCount > 0;
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

  async listPrintable(storeIds: string[]): Promise<OrderRecord[]> {
    const orders = await prisma.order.findMany({
      where: { storeId: { in: storeIds }, status: { in: ["PENDING", "ERROR"] } },
      orderBy: { createdAt: "desc" },
    });
    return orders.map(toOrderRecord);
  }

  async deleteAll(): Promise<void> {
    await prisma.order.deleteMany({});
  }

  async deletePrintedBefore(cutoff: Date): Promise<number> {
    const { count } = await prisma.order.deleteMany({
      where: { status: "PRINTED", updatedAt: { lt: cutoff } },
    });
    return count;
  }

  async recordProcessed(entries: ProcessedOrderEntry[]): Promise<void> {
    if (entries.length === 0) {
      return;
    }
    await prisma.processedOrder.createMany({ data: entries, skipDuplicates: true });
  }

  async deleteByIds(ids: string[]): Promise<void> {
    await prisma.order.deleteMany({ where: { id: { in: ids } } });
  }
}
