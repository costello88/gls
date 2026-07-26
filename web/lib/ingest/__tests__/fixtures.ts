import type { RawShopifyOrder } from "../shopify";
import type { RawWooCommerceOrder } from "../woocommerce";

export function makeRawShopifyOrder(overrides: Partial<RawShopifyOrder> = {}): RawShopifyOrder {
  return {
    id: 1001,
    name: "#1001",
    created_at: "2026-07-25T10:00:00Z",
    contact_email: "jan@voorbeeld.be",
    customer: { email: "jan@voorbeeld.be", phone: "+32470123456" },
    shipping_address: {
      name: "Jan Peeters",
      address1: "Kerkstraat 12",
      address2: "",
      zip: "2000",
      city: "Antwerpen",
      country_code: "BE",
      phone: "+32470123456",
    },
    ...overrides,
  };
}

export function makeRawWooCommerceOrder(
  overrides: Partial<RawWooCommerceOrder> = {},
): RawWooCommerceOrder {
  return {
    id: 2001,
    number: "2001",
    date_created: "2026-07-25T11:00:00",
    billing: {
      first_name: "Ingrid",
      last_name: "Op den Buijs",
      email: "ingrid@voorbeeld.nl",
      phone: "+31612345678",
    },
    shipping: {
      first_name: "Ingrid",
      last_name: "Op den Buijs",
      address_1: "Boekweitveld",
      address_2: "11",
      city: "Empel",
      postcode: "5236 WR",
      country: "NL",
    },
    ...overrides,
  };
}
