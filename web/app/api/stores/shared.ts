import { NextResponse } from "next/server";
import { createStore, listStores, updateStore } from "../../../lib/dashboard/stores";
import type { StoreInput, StoreRepository } from "../../../lib/dashboard/types";

export async function handleListStores(repo: StoreRepository): Promise<Response> {
  const stores = await listStores(repo);
  return NextResponse.json({ stores });
}

export async function handleCreateStore(request: Request, repo: StoreRepository): Promise<Response> {
  const input = (await request.json()) as StoreInput;
  try {
    const store = await createStore(repo, input);
    return NextResponse.json({ store });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}

export async function handleUpdateStore(
  request: Request,
  repo: StoreRepository,
  id: string,
): Promise<Response> {
  const edits = (await request.json()) as Partial<StoreInput>;
  try {
    const store = await updateStore(repo, id, edits);
    return NextResponse.json({ store });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }
}
