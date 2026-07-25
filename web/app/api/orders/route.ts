import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { handleListOrders } from "./shared";

const repository = new PrismaOrderRepository();

export async function GET(request: Request): Promise<Response> {
  return handleListOrders(request, repository);
}
