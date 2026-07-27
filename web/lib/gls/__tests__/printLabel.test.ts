import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../createLabel", () => ({
  createGlsLabel: vi.fn(),
}));

import { createGlsLabel } from "../createLabel";
import { printGlsLabel } from "../printLabel";
import type { NormalizedShipment } from "../types";

const mockedCreateGlsLabel = vi.mocked(createGlsLabel);

const shipment: NormalizedShipment = {
  name: "Jan Peeters",
  street: "Kerkstraat",
  houseNo: "12A",
  zipCode: "2000",
  city: "Antwerpen",
  countryCode: "BE",
  phone: "+32470123456",
  email: "jan@voorbeeld.be",
  weightKg: 1.5,
  reference: "1042",
};

beforeEach(() => {
  mockedCreateGlsLabel.mockReset();
});

describe("printGlsLabel", () => {
  it("creates the label and returns it without confirming it", async () => {
    mockedCreateGlsLabel.mockResolvedValue({
      label: "base64-label-data",
      trackingLink: "",
      unitTrackingLink: "",
      transactionId: "txn-1",
      unitNo: "11850080202728",
    });

    const result = await printGlsLabel(shipment, "pdf", "11850079");

    expect(mockedCreateGlsLabel).toHaveBeenCalledWith(shipment, "pdf", "11850079");
    expect(result.label).toBe("base64-label-data");
  });

  it("propagates an error if creating the label fails", async () => {
    mockedCreateGlsLabel.mockRejectedValue(new Error("GLS unavailable"));

    await expect(printGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow("GLS unavailable");
  });
});
