import { printGlsLabel } from "../../../../lib/gls/printLabel";
import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleCronSync } from "./shared";

const storeRepository = new PrismaStoreRepository();
const orderRepository = new PrismaOrderRepository();

export async function GET(request: Request): Promise<Response> {
  return handleCronSync(request, storeRepository, orderRepository, printGlsLabel);
}
