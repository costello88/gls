import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../lib/repositories/storeRepository";
import { handleSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function POST(): Promise<Response> {
  return handleSync(storeRepository, orderRepository);
}
