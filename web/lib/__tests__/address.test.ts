import { describe, expect, it } from "vitest";
import { splitAddress } from "../address";

describe("splitAddress", () => {
  it("splits a simple number", () => {
    expect(splitAddress("Kerkstraat 12")).toEqual({ street: "Kerkstraat", houseNo: "12" });
  });

  it("splits a number with a letter suffix", () => {
    expect(splitAddress("Kerkstraat 12A")).toEqual({ street: "Kerkstraat", houseNo: "12A" });
  });

  it("splits a number with a bus suffix", () => {
    expect(splitAddress("Kerkstraat 12 bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "12 bus 3",
    });
  });

  it("returns the whole string as street when no number is present", () => {
    expect(splitAddress("Onbekende straat")).toEqual({ street: "Onbekende straat", houseNo: "" });
  });

  it("treats a leading number as part of the street when a trailing number exists", () => {
    expect(splitAddress("12 Kerkstraat 34")).toEqual({ street: "12 Kerkstraat", houseNo: "34" });
  });

  it("uses address2 as the house number when address1 has none", () => {
    expect(splitAddress("Boekweitveld", "11")).toEqual({ street: "Boekweitveld", houseNo: "11" });
  });

  it("normalizes a letter addition from address2", () => {
    expect(splitAddress("Kerkstraat", "11 a")).toEqual({ street: "Kerkstraat", houseNo: "11A" });
  });

  it("keeps a bus addition from address2 space-separated", () => {
    expect(splitAddress("Kerkstraat", "11 bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "11 bus 3",
    });
  });

  it("attaches a letter addition from address2 to an existing house number", () => {
    expect(splitAddress("Kerkstraat 12", "A")).toEqual({ street: "Kerkstraat", houseNo: "12A" });
  });

  it("attaches a bus addition from address2 to an existing house number", () => {
    expect(splitAddress("Kerkstraat 12", "bus 3")).toEqual({
      street: "Kerkstraat",
      houseNo: "12 bus 3",
    });
  });

  it("drops a city name typed onto the end of address1 after the house number", () => {
    expect(splitAddress("Zandstraat 29A Hasselt")).toEqual({
      street: "Zandstraat",
      houseNo: "29A",
    });
  });

  it("is unaffected by an empty address2", () => {
    expect(splitAddress("Kerkstraat 12", "")).toEqual({ street: "Kerkstraat", houseNo: "12" });
    expect(splitAddress("Kerkstraat 12")).toEqual({ street: "Kerkstraat", houseNo: "12" });
  });
});
