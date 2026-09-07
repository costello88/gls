import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { handleDismissOrders } from "../shared";

const repository = new PrismaOrderRepository();

export async function POST(request: Request): Promise<Response> {
  return handleDismissOrders(request, repository);
}
