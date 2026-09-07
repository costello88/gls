import { describe, expect, it } from "vitest";
import { usesFulfillmentWorkflow } from "../fulfillmentPolicy";
import type { StoreRecord } from "../types";

function makeStore(overrides: Partial<StoreRecord> = {}): StoreRecord {
  return {
    id: "store-1",
    type: "SHOPIFY",
    name: "Revitalash",
    automationEnabled: false,
    markFulfilledOnExport: true,
    customerNo: "11850079",
    defaultWeightKg: 1.5,
    shopDomain: "revitalash.myshopify.com",
    shopifyAccessToken: "shpat_test",
    siteUrl: null,
    wooConsumerKey: null,
    wooConsumerSecret: null,
    ...overrides,
  };
}

describe("usesFulfillmentWorkflow", () => {
  it("is true for a normal store with the toggle on", () => {
    expect(usesFulfillmentWorkflow(makeStore())).toBe(true);
  });

  it("is false when the per-store toggle is off", () => {
    expect(usesFulfillmentWorkflow(makeStore({ markFulfilledOnExport: false }))).toBe(false);
  });

  it("is always false for murad.nl, regardless of the toggle", () => {
    expect(
      usesFulfillmentWorkflow(
        makeStore({
          type: "WOOCOMMERCE",
          shopDomain: null,
          siteUrl: "https://murad.nl",
          markFulfilledOnExport: true,
        }),
      ),
    ).toBe(false);
  });

  it("matches murad.nl on a shopDomain too, case-insensitively", () => {
    expect(usesFulfillmentWorkflow(makeStore({ shopDomain: "MURAD.NL" }))).toBe(false);
  });
});
