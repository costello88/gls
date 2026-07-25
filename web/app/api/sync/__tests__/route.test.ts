import { describe, expect, it, vi } from "vitest";

vi.mock("../../../../lib/ingest/sync", () => ({
  syncStore: vi.fn(),
}));

import { syncStore } from "../../../../lib/ingest/sync";
import { handleSync } from "../shared";
import type { StoreRecord, StoreRepository } from "../../../../lib/dashboard/types";

const mockedSyncStore = vi.mocked(syncStore);

class FakeStoreRepository implements StoreRepository {
  constructor(private stores: StoreRecord[]) {}

  async list(): Promise<StoreRecord[]> {
    return this.stores;
  }

  async get(id: string): Promise<StoreRecord | null> {
    return this.stores.find((s) => s.id === id) ?? null;
  }

  async create(): Promise<StoreRecord> {
    throw new Error("not used");
  }

  async update(): Promise<StoreRecord> {
    throw new Error("not used");
  }
}

const store1: StoreRecord = {
  id: "store-1",
  type: "SHOPIFY",
  name: "Revitalash",
  automationEnabled: false,
  customerNo: "11850079",
  defaultWeightKg: 1.0,
  shopDomain: "revitalash.myshopify.com",
  shopifyAccessToken: "shpat_test",
  siteUrl: null,
  wooConsumerKey: null,
  wooConsumerSecret: null,
};

describe("handleSync", () => {
  it("syncs every store and returns per-store results", async () => {
    mockedSyncStore.mockResolvedValue({ new: 2, valid: 1, invalid: 1 });
    const storeRepo = new FakeStoreRepository([store1]);

    const response = await handleSync(storeRepo, {} as any);
    const body = (await response.json()) as { results: Record<string, unknown> };

    expect(response.status).toBe(200);
    expect(body.results["store-1"]).toEqual({ new: 2, valid: 1, invalid: 1 });
    expect(mockedSyncStore).toHaveBeenCalledTimes(1);
  });
});
