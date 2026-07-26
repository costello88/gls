import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handlePreviewSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function GET(): Promise<Response> {
  return handlePreviewSync(storeRepository, orderRepository);
}
