import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleConfirmSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function POST(request: Request): Promise<Response> {
  return handleConfirmSync(request, storeRepository, orderRepository);
}
