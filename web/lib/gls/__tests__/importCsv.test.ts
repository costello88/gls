import { describe, expect, it } from "vitest";
import { buildGlsImportCsv, type GlsImportRow } from "../importCsv";

function makeRow(overrides: Partial<GlsImportRow> = {}): GlsImportRow {
  return {
    name: "Jan Peeters",
    street: "Kerkstraat",
    houseNo: "12A",
    zipCode: "2000",
    city: "Antwerpen",
    countryCode: "BE",
    phone: "+32470123456",
    email: "jan@voorbeeld.be",
    orderNumber: "#1042",
    senderNumber: "11850079",
    ...overrides,
  };
}

describe("buildGlsImportCsv", () => {
  it("writes a header row followed by one row per order with fixed weight, colli and packaging code", () => {
    const csv = buildGlsImportCsv([makeRow()]);
    const lines = csv.trim().split("\r\n");

    expect(lines[0]).toBe(
      "Name,Street,HouseNo,PostalCode,City,Country,Phone,Email,SenderNumber,Weight,Colli,PackagingCode,Reference",
    );
    expect(lines[1]).toBe(
      "Jan Peeters,Kerkstraat,12A,2000,Antwerpen,BE,+32470123456,jan@voorbeeld.be,11850079,1,1,PCO,#1042",
    );
  });

  it("writes one row per order and preserves per-order sender number", () => {
    const csv = buildGlsImportCsv([
      makeRow({ name: "Jan Peeters", senderNumber: "11850079" }),
      makeRow({ name: "Marie Dubois", senderNumber: "11850080" }),
    ]);
    const lines = csv.trim().split("\r\n");

    expect(lines).toHaveLength(3);
    expect(lines[1]).toContain("Jan Peeters");
    expect(lines[1]).toContain("11850079");
    expect(lines[2]).toContain("Marie Dubois");
    expect(lines[2]).toContain("11850080");
  });

  it("quotes fields containing commas or quotes", () => {
    const csv = buildGlsImportCsv([makeRow({ name: 'Jan "The Man" Peeters, Jr.' })]);
    const lines = csv.trim().split("\r\n");

    expect(lines[1]).toContain('"Jan ""The Man"" Peeters, Jr."');
  });
});
