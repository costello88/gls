import { splitAddress } from "../address";
import type { RawShopifyOrder } from "./shopify";
import type { RawWooCommerceOrder } from "./woocommerce";
import type { NormalizedOrderInput } from "./types";

export function normalizeShopifyOrder(order: RawShopifyOrder): NormalizedOrderInput {
  const shipping = order.shipping_address ?? {};
  const { street, houseNo } = splitAddress(shipping.address1 ?? "", shipping.address2 ?? "");
  const email = order.contact_email ?? order.customer?.email ?? "";
  const phone = shipping.phone ?? order.customer?.phone ?? "";

  return {
    sourceOrderId: String(order.id),
    orderNumber: order.name,
    name: shipping.name ?? "",
    street,
    houseNo,
    zipCode: shipping.zip ?? "",
    city: shipping.city ?? "",
    countryCode: shipping.country_code ?? "",
    phone,
    email,
  };
}

export function normalizeWooCommerceOrder(order: RawWooCommerceOrder): NormalizedOrderInput {
  const shipping = order.shipping ?? {};
  const billing = order.billing ?? {};
  const { street, houseNo } = splitAddress(shipping.address_1 ?? "", shipping.address_2 ?? "");

  const shippingHasName = Boolean(shipping.first_name || shipping.last_name);
  const firstName = shippingHasName ? shipping.first_name : billing.first_name;
  const lastName = shippingHasName ? shipping.last_name : billing.last_name;
  const name = [firstName, lastName].filter(Boolean).join(" ");

  return {
    sourceOrderId: String(order.id),
    orderNumber: order.number,
    name,
    street,
    houseNo,
    zipCode: shipping.postcode ?? "",
    city: shipping.city ?? "",
    countryCode: shipping.country ?? "",
    phone: billing.phone ?? "",
    email: billing.email ?? "",
  };
}
