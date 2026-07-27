import { printGlsLabel } from "../../../../../lib/gls/printLabel";
import { PrismaOrderRepository } from "../../../../../lib/repositories/orderRepository";
import { handlePrintOrder } from "../../shared";

const repository = new PrismaOrderRepository();

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handlePrintOrder(repository, id, printGlsLabel);
}
