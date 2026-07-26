import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGlsLabel } from "../createLabel";
import { GlsApiError } from "../errors";
import type { NormalizedShipment } from "../types";

vi.mock("../client", () => ({
  postGlsApi: vi.fn(),
}));

import { postGlsApi } from "../client";

const mockedPostGlsApi = vi.mocked(postGlsApi);

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
  reference: "#1042",
};

beforeEach(() => {
  mockedPostGlsApi.mockReset();
  process.env.GLS_USERNAME = "test-user";
  process.env.GLS_PASSWORD = "test-pass";
});

describe("createGlsLabel", () => {
  it("sends the expected request body", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        transactionId: "txn-1",
        shipmentTrackingLink: "https://track.gls/txn-1",
        labels: "base64-label-data",
        units: [{ unitTrackingLink: "https://track.gls/unit-1" }],
      },
      text: "",
    });

    await createGlsLabel(shipment, "pdf", "11850079");

    expect(mockedPostGlsApi).toHaveBeenCalledWith(
      "/Label/Create",
      expect.objectContaining({
        username: "test-user",
        password: "test-pass",
        customerNo: "11850079",
        shiptype: "p",
        reference: "1042",
        labelType: "pdf",
        units: [
          expect.objectContaining({
            unitId: "1042",
            unitType: "co",
            weight: 1.5,
          }),
        ],
        addresses: {
          deliveryAddress: expect.objectContaining({
            name1: "Jan Peeters",
            street: "Kerkstraat",
            houseNo: "12A",
            zipCode: "2000",
            city: "Antwerpen",
            countryCode: "BE",
            phone: "+32470123456",
            email: "jan@voorbeeld.be",
            addresseeType: "p",
          }),
        },
      }),
    );
  });

  it("strips non-alphanumeric characters from the reference and unit ID", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        transactionId: "txn-1",
        shipmentTrackingLink: "https://track.gls/txn-1",
        labels: "base64-label-data",
        units: [{ unitTrackingLink: "https://track.gls/unit-1" }],
      },
      text: "",
    });

    await createGlsLabel({ ...shipment, reference: "#1042 / A" }, "pdf", "11850079");

    expect(mockedPostGlsApi).toHaveBeenCalledWith(
      "/Label/Create",
      expect.objectContaining({
        reference: "1042A",
        units: [expect.objectContaining({ unitId: "1042A" })],
      }),
    );
  });

  it("returns a CreateLabelResult on success", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        transactionId: "txn-1",
        shipmentTrackingLink: "https://track.gls/txn-1",
        labels: "base64-label-data",
        units: [{ unitTrackingLink: "https://track.gls/unit-1" }],
      },
      text: "",
    });

    const result = await createGlsLabel(shipment, "pdf", "11850079");

    expect(result).toEqual({
      label: "base64-label-data",
      trackingLink: "https://track.gls/txn-1",
      unitTrackingLink: "https://track.gls/unit-1",
      transactionId: "txn-1",
    });
  });

  it("reads the label from units[0].label when there is no top-level labels/shipmentTrackingLink (real GLS response shape)", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: false,
        status: "200",
        message: null,
        transactionId: "txn-1",
        units: [{ unitId: "49807", unitNo: "11850080202728", uniqueNo: "00L1VQ9R", label: "base64-label-data" }],
      },
      text: "",
    });

    const result = await createGlsLabel(shipment, "pdf", "11850079");

    expect(result).toEqual({
      label: "base64-label-data",
      trackingLink: "",
      unitTrackingLink: "",
      transactionId: "txn-1",
    });
  });

  it("throws GlsApiError when error is true inside an HTTP 200 response", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: {
        error: true,
        status: "422",
        message: "A123: Invalid postcode",
        errors: { zipCode: "invalid" },
      },
      text: "",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(
      "A123: Invalid postcode",
    );
  });

  it.each([400, 401, 422, 424])(
    "throws GlsApiError with httpStatus %i for non-200 responses",
    async (httpStatus) => {
      mockedPostGlsApi.mockResolvedValue({
        httpStatus,
        json: {
          error: true,
          status: String(httpStatus),
          message: `Request failed with ${httpStatus}`,
          errors: {},
        },
        text: "",
      });

      try {
        await createGlsLabel(shipment, "pdf", "11850079");
        expect.fail("expected createGlsLabel to throw");
      } catch (err) {
        expect(err).toBeInstanceOf(GlsApiError);
        expect((err as GlsApiError).httpStatus).toBe(httpStatus);
        expect((err as GlsApiError).message).toBe(`Request failed with ${httpStatus}`);
      }
    },
  );

  it("throws GlsApiError when the response body is not JSON", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: null,
      text: "<html>Internal Server Error</html>",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
  });

  it("throws GlsApiError when a successful response is missing expected fields", async () => {
    mockedPostGlsApi.mockResolvedValue({
      httpStatus: 200,
      json: { error: false },
      text: "",
    });

    await expect(createGlsLabel(shipment, "pdf", "11850079")).rejects.toThrow(GlsApiError);
  });
});
