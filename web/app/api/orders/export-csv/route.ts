import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleExportOrders } from "../shared";

const repository = new PrismaOrderRepository();
const storeRepository = new PrismaStoreRepository();

export async function POST(request: Request): Promise<Response> {
  return handleExportOrders(request, repository, storeRepository);
}
