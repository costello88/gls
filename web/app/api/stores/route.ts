import { PrismaStoreRepository } from "../../../lib/repositories/storeRepository";
import { handleCreateStore, handleListStores } from "./shared";

const repository = new PrismaStoreRepository();

export async function GET(): Promise<Response> {
  return handleListStores(repository);
}

export async function POST(request: Request): Promise<Response> {
  return handleCreateStore(request, repository);
}
