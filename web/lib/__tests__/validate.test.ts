import { describe, expect, it } from "vitest";
import { checkOrder, validateCountry, validateEmail, validatePhone } from "../validate";

describe("validateEmail", () => {
  it("accepts a valid email", () => {
    expect(validateEmail("klant@voorbeeld.be")).toBe(true);
  });

  it("rejects a missing @", () => {
    expect(validateEmail("klantvoorbeeld.be")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateEmail("")).toBe(false);
  });
});

describe("validatePhone", () => {
  it("accepts a BE international number", () => {
    expect(validatePhone("+32 470 12 34 56", "BE")).toBe(true);
  });

  it("accepts a BE local number", () => {
    expect(validatePhone("0470123456", "BE")).toBe(true);
  });

  it("accepts an NL international number", () => {
    expect(validatePhone("+31 6 12345678", "NL")).toBe(true);
  });

  it("accepts an LU international number", () => {
    expect(validatePhone("+352 621123456", "LU")).toBe(true);
  });

  it("rejects a too-short number", () => {
    expect(validatePhone("0470", "BE")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validatePhone("", "BE")).toBe(false);
  });
});

describe("validateCountry", () => {
  it("accepts supported countries", () => {
    expect(validateCountry("BE")).toBe(true);
    expect(validateCountry("NL")).toBe(true);
    expect(validateCountry("LU")).toBe(true);
  });

  it("rejects unsupported countries", () => {
    expect(validateCountry("DE")).toBe(false);
  });
});

describe("checkOrder", () => {
  it("passes a clean order", () => {
    expect(
      checkOrder({ email: "klant@voorbeeld.be", phone: "+32470123456", countryCode: "BE" }),
    ).toEqual([]);
  });

  it("flags a bad email", () => {
    const reasons = checkOrder({ email: "kapot", phone: "+32470123456", countryCode: "BE" });
    expect(reasons.some((r) => r.includes("Email"))).toBe(true);
  });

  it("flags a bad phone", () => {
    const reasons = checkOrder({ email: "klant@voorbeeld.be", phone: "123", countryCode: "BE" });
    expect(reasons.some((r) => r.includes("Telefoon"))).toBe(true);
  });

  it("flags an unsupported country", () => {
    const reasons = checkOrder({
      email: "klant@voorbeeld.be",
      phone: "+32470123456",
      countryCode: "DE",
    });
    expect(reasons.some((r) => r.includes("Land"))).toBe(true);
  });

  it("flags multiple reasons at once", () => {
    const reasons = checkOrder({ email: "kapot", phone: "123", countryCode: "BE" });
    expect(reasons).toHaveLength(2);
  });
});
