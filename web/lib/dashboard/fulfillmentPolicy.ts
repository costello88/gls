import type { StoreRecord } from "./types";

// Stores whose own order workflow never uses a "fulfilled"/"completed"
// status -- marking orders there would interfere with how they run, so
// these are always skipped automatically, regardless of the per-store
// "Afhandelen na export" toggle. No manual configuration needed for them.
const NO_FULFILLMENT_DOMAINS = ["murad.nl"];

function storeDomain(store: StoreRecord): string {
  return (store.shopDomain ?? store.siteUrl ?? "").toLowerCase();
}

export function usesFulfillmentWorkflow(store: StoreRecord): boolean {
  if (NO_FULFILLMENT_DOMAINS.some((domain) => storeDomain(store).includes(domain))) {
    return false;
  }
  return store.markFulfilledOnExport;
}
