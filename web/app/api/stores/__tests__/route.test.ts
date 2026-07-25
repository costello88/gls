import { describe, expect, it } from "vitest";
import type { StoreInput, StoreRecord, StoreRepository } from "../../../../lib/dashboard/types";
import { handleCreateStore, handleDeleteStore, handleListStores, handleUpdateStore } from "../shared";

class FakeStoreRepository implements StoreRepository {
  private stores = new Map<string, StoreRecord>();
  private nextId = 1;

  async list(): Promise<StoreRecord[]> {
    return [...this.stores.values()];
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.get(id) ?? null;
  }

  async create(input: StoreInput): Promise<StoreRecord> {
    const id = `store-${this.nextId++}`;
    const record: StoreRecord = {
      id,
      type: input.type,
      name: input.name,
      automationEnabled: input.automationEnabled ?? false,
      customerNo: input.customerNo,
      defaultWeightKg: input.defaultWeightKg,
      shopDomain: input.shopDomain ?? null,
      shopifyAccessToken: input.shopifyAccessToken ?? null,
      siteUrl: input.siteUrl ?? null,
      wooConsumerKey: input.wooConsumerKey ?? null,
      wooConsumerSecret: input.wooConsumerSecret ?? null,
    };
    this.stores.set(id, record);
    return record;
  }

  async update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord> {
    const existing = this.stores.get(id);
    if (!existing) throw new Error(`Store ${id} not found`);
    const updated = { ...existing, ...edits };
    this.stores.set(id, updated);
    return updated;
  }

  async delete(id: string): Promise<void> {
    this.stores.delete(id);
  }
}

const shopifyInput: StoreInput = {
  type: "SHOPIFY",
  name: "Revitalash",
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
};

describe("handleListStores", () => {
  it("returns all stores", async () => {
    const repo = new FakeStoreRepository();
    await repo.create(shopifyInput);

    const response = await handleListStores(repo);
    const body = (await response.json()) as { stores: StoreRecord[] };

    expect(response.status).toBe(200);
    expect(body.stores).toHaveLength(1);
  });
});

describe("handleCreateStore", () => {
  it("creates a valid store", async () => {
    const repo = new FakeStoreRepository();
    const request = new Request("https://example.com/api/stores", {
      method: "POST",
      body: JSON.stringify(shopifyInput),
    });

    const response = await handleCreateStore(request, repo);
    const body = (await response.json()) as { store: StoreRecord };

    expect(response.status).toBe(200);
    expect(body.store.name).toBe("Revitalash");
  });

  it("returns a 400 with the validation message for an invalid store", async () => {
    const repo = new FakeStoreRepository();
    const request = new Request("https://example.com/api/stores", {
      method: "POST",
      body: JSON.stringify({ ...shopifyInput, shopifyAccessToken: "" }),
    });

    const response = await handleCreateStore(request, repo);
    const body = (await response.json()) as { error: string };

    expect(response.status).toBe(400);
    expect(body.error).toContain("access token");
  });
});

describe("handleUpdateStore", () => {
  it("applies edits to an existing store", async () => {
    const repo = new FakeStoreRepository();
    const created = await repo.create(shopifyInput);
    const request = new Request(`https://example.com/api/stores/${created.id}`, {
      method: "PATCH",
      body: JSON.stringify({ automationEnabled: true }),
    });

    const response = await handleUpdateStore(request, repo, created.id);
    const body = (await response.json()) as { store: StoreRecord };

    expect(response.status).toBe(200);
    expect(body.store.automationEnabled).toBe(true);
  });
});

describe("handleDeleteStore", () => {
  it("removes the store and returns ok", async () => {
    const repo = new FakeStoreRepository();
    const created = await repo.create(shopifyInput);

    const response = await handleDeleteStore(repo, created.id);
    const body = (await response.json()) as { ok: boolean };

    expect(response.status).toBe(200);
    expect(body.ok).toBe(true);
    expect(await repo.list()).toHaveLength(0);
  });
});
