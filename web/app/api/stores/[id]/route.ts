import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleUpdateStore } from "../shared";

const repository = new PrismaStoreRepository();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleUpdateStore(request, repository, id);
}
