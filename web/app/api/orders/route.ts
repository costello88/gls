import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { handleClearOrders, handleListOrders } from "./shared";

const repository = new PrismaOrderRepository();

export async function GET(request: Request): Promise<Response> {
  return handleListOrders(request, repository);
}

export async function DELETE(): Promise<Response> {
  return handleClearOrders(repository);
}
