import type { StoreInput, StoreRecord, StoreRepository } from "./types";

function validateStoreInput(input: StoreInput): string[] {
  const errors: string[] = [];
  if (!input.name) errors.push("Naam is verplicht");
  if (!input.customerNo) errors.push("GLS klantnummer is verplicht");

  if (input.type === "SHOPIFY") {
    if (!input.shopDomain) errors.push("Shopify domein is verplicht");
    if (!input.shopifyAccessToken) errors.push("Shopify access token is verplicht");
  } else {
    if (!input.siteUrl) errors.push("Site URL is verplicht");
    if (!input.wooConsumerKey) errors.push("Consumer key is verplicht");
    if (!input.wooConsumerSecret) errors.push("Consumer secret is verplicht");
  }

  return errors;
}

export async function listStores(repo: StoreRepository): Promise<StoreRecord[]> {
  return repo.list();
}

export async function createStore(
  repo: StoreRepository,
  input: StoreInput,
): Promise<StoreRecord> {
  const errors = validateStoreInput(input);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return repo.create(input);
}

export async function updateStore(
  repo: StoreRepository,
  id: string,
  edits: Partial<StoreInput>,
): Promise<StoreRecord> {
  const existing = await repo.get(id);
  if (!existing) {
    throw new Error(`Store ${id} not found`);
  }
  const merged: StoreInput = { ...existing, ...edits };
  const errors = validateStoreInput(merged);
  if (errors.length > 0) {
    throw new Error(errors.join("; "));
  }
  return repo.update(id, edits);
}
