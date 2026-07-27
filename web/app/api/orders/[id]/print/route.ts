import { printGlsLabel } from "../../../../../lib/gls/printLabel";
import { PrismaOrderRepository } from "../../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../../lib/repositories/storeRepository";
import { handlePrintOrder } from "../../shared";

const repository = new PrismaOrderRepository();
const storeRepository = new PrismaStoreRepository();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handlePrintOrder(repository, storeRepository, id, printGlsLabel);
}
