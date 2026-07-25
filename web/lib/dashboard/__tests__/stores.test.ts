import { describe, expect, it } from "vitest";
import { createStore, deleteStore, listStores, updateStore } from "../stores";
import type { StoreInput, StoreRecord, StoreRepository } from "../types";

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

describe("createStore", () => {
  it("creates a valid Shopify store", async () => {
    const repo = new FakeStoreRepository();
    const result = await createStore(repo, shopifyInput);
    expect(result.name).toBe("Revitalash");
    expect(await listStores(repo)).toHaveLength(1);
  });

  it("rejects a Shopify store missing required credentials", async () => {
    const repo = new FakeStoreRepository();
    await expect(createStore(repo, { ...shopifyInput, shopifyAccessToken: "" })).rejects.toThrow(
      "access token",
    );
  });

  it("rejects a WooCommerce store missing required credentials", async () => {
    const repo = new FakeStoreRepository();
    await expect(
      createStore(repo, {
        type: "WOOCOMMERCE",
        name: "WooStore",
        customerNo: "11850080",
        defaultWeightKg: 1.0,
        siteUrl: "https://example.com",
        wooConsumerKey: "",
        wooConsumerSecret: "",
      }),
    ).rejects.toThrow("Consumer key");
  });
});

describe("updateStore", () => {
  it("applies edits to an existing store", async () => {
    const repo = new FakeStoreRepository();
    const created = await createStore(repo, shopifyInput);
    const updated = await updateStore(repo, created.id, { automationEnabled: true });
    expect(updated.automationEnabled).toBe(true);
  });

  it("rejects edits that would leave required fields empty", async () => {
    const repo = new FakeStoreRepository();
    const created = await createStore(repo, shopifyInput);
    await expect(updateStore(repo, created.id, { shopifyAccessToken: "" })).rejects.toThrow(
      "access token",
    );
  });
});

describe("deleteStore", () => {
  it("removes the store", async () => {
    const repo = new FakeStoreRepository();
    const created = await createStore(repo, shopifyInput);

    await deleteStore(repo, created.id);

    expect(await listStores(repo)).toHaveLength(0);
  });
});
