import { checkOrder } from "../validate";
import { fetchShopifyOrders } from "./shopify";
import { fetchWooCommerceOrders } from "./woocommerce";
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from "./normalize";
import type { NormalizedOrderInput, OrderRepository, StoreConfig, SyncResult } from "./types";

// Names that are always test/personal checkouts on this account, never real
// customer orders -- matched case-insensitively against the shipping name.
const IGNORED_TEST_NAMES = ["silvester jensch"];

function isTestOrder(name: string): boolean {
  return IGNORED_TEST_NAMES.includes(name.trim().toLowerCase());
}

async function processOrder(
  normalized: NormalizedOrderInput,
  store: StoreConfig,
  repository: OrderRepository,
  result: SyncResult,
): Promise<void> {
  const alreadyExists = await repository.exists(store.id, normalized.sourceOrderId);
  if (alreadyExists) {
    return;
  }

  result.new += 1;

  if (isTestOrder(normalized.name)) {
    result.ignored += 1;
    await repository.create({
      storeId: store.id,
      sourceOrderId: normalized.sourceOrderId,
      orderNumber: normalized.orderNumber,
      name: normalized.name,
      street: normalized.street,
      houseNo: normalized.houseNo,
      zipCode: normalized.zipCode,
      city: normalized.city,
      countryCode: normalized.countryCode,
      phone: normalized.phone,
      email: normalized.email,
      weightKg: store.defaultWeightKg,
      customerNo: store.customerNo,
      status: "IGNORED",
      reviewReason: "Testbestelling - automatisch genegeerd",
    });
    return;
  }

  const reasons = checkOrder({
    email: normalized.email,
    phone: normalized.phone,
    countryCode: normalized.countryCode,
  });

  await repository.create({
    storeId: store.id,
    sourceOrderId: normalized.sourceOrderId,
    orderNumber: normalized.orderNumber,
    name: normalized.name,
    street: normalized.street,
    houseNo: normalized.houseNo,
    zipCode: normalized.zipCode,
    city: normalized.city,
    countryCode: normalized.countryCode,
    phone: normalized.phone,
    email: normalized.email,
    weightKg: store.defaultWeightKg,
    customerNo: store.customerNo,
    status: reasons.length > 0 ? "NEEDS_REVIEW" : "PENDING",
    reviewReason: reasons.length > 0 ? reasons.join("; ") : null,
  });

  if (reasons.length > 0) {
    result.invalid += 1;
  } else {
    result.valid += 1;
  }
}

export async function syncStore(
  store: StoreConfig,
  repository: OrderRepository,
): Promise<SyncResult> {
  const result: SyncResult = { new: 0, valid: 0, invalid: 0, ignored: 0 };

  try {
    if (store.type === "SHOPIFY") {
      const rawOrders = await fetchShopifyOrders(store);
      for (const raw of rawOrders) {
        await processOrder(normalizeShopifyOrder(raw), store, repository, result);
      }
    } else {
      const rawOrders = await fetchWooCommerceOrders(store);
      for (const raw of rawOrders) {
        await processOrder(normalizeWooCommerceOrder(raw), store, repository, result);
      }
    }
  } catch (err) {
    return { new: 0, valid: 0, invalid: 0, ignored: 0, error: (err as Error).message };
  }

  return result;
}
