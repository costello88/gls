import { describe, expect, it } from "vitest";
import { normalizeShopifyOrder, normalizeWooCommerceOrder } from "../normalize";
import { makeRawShopifyOrder, makeRawWooCommerceOrder } from "./fixtures";

describe("normalizeShopifyOrder", () => {
  it("maps a standard order", () => {
    const order = makeRawShopifyOrder();
    expect(normalizeShopifyOrder(order)).toEqual({
      sourceOrderId: "1001",
      orderNumber: "#1001",
      name: "Jan Peeters",
      street: "Kerkstraat",
      houseNo: "12",
      zipCode: "2000",
      city: "Antwerpen",
      countryCode: "BE",
      phone: "+32470123456",
      email: "jan@voorbeeld.be",
    });
  });

  it("falls back to address2 for the house number", () => {
    const order = makeRawShopifyOrder({
      shipping_address: {
        name: "Ingrid Op den Buijs",
        address1: "Boekweitveld",
        address2: "11",
        zip: "5236 WR",
        city: "Empel",
        country_code: "NL",
        phone: "+31612345678",
      },
    });
    const result = normalizeShopifyOrder(order);
    expect(result.street).toBe("Boekweitveld");
    expect(result.houseNo).toBe("11");
  });

  it("falls back to customer email/phone when order-level fields are absent", () => {
    const order = makeRawShopifyOrder({ contact_email: undefined });
    order.shipping_address!.phone = undefined;
    const result = normalizeShopifyOrder(order);
    expect(result.email).toBe("jan@voorbeeld.be");
    expect(result.phone).toBe("+32470123456");
  });
});

describe("normalizeWooCommerceOrder", () => {
  it("maps a standard order using shipping name and billing contact info", () => {
    const order = makeRawWooCommerceOrder();
    expect(normalizeWooCommerceOrder(order)).toEqual({
      sourceOrderId: "2001",
      orderNumber: "2001",
      name: "Ingrid Op den Buijs",
      street: "Boekweitveld",
      houseNo: "11",
      zipCode: "5236 WR",
      city: "Empel",
      countryCode: "NL",
      phone: "+31612345678",
      email: "ingrid@voorbeeld.nl",
    });
  });

  it("falls back to billing name when shipping has no name", () => {
    const order = makeRawWooCommerceOrder({
      shipping: {
        first_name: "",
        last_name: "",
        address_1: "Boekweitveld",
        address_2: "11",
        city: "Empel",
        postcode: "5236 WR",
        country: "NL",
      },
    });
    const result = normalizeWooCommerceOrder(order);
    expect(result.name).toBe("Ingrid Op den Buijs");
  });
});
