import { PrismaStoreRepository } from "../../../../lib/repositories/storeRepository";
import { handleDeleteStore, handleUpdateStore } from "../shared";

const repository = new PrismaStoreRepository();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleUpdateStore(request, repository, id);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleDeleteStore(repository, id);
}
