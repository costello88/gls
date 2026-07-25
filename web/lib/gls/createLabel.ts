import { postGlsApi } from "./client";
import { GlsApiError } from "./errors";
import type { CreateLabelResult, LabelType, NormalizedShipment } from "./types";

interface ApiCreateLabelResponse {
  error?: boolean;
  status?: string;
  message?: string;
  errors?: unknown;
  transactionId?: string;
  shipmentTrackingLink?: string;
  labels?: string;
  units?: Array<{ unitTrackingLink?: string }>;
}

export async function createGlsLabel(
  shipment: NormalizedShipment,
  labelType: LabelType,
  customerNo: string,
): Promise<CreateLabelResult> {
  const requestBody = {
    username: process.env.GLS_USERNAME,
    password: process.env.GLS_PASSWORD,
    shippingSystemName: "gls-sync-web",
    shippingSystemVersion: "1.0",
    shiptype: "p",
    customerNo,
    reference: shipment.reference,
    units: [
      {
        unitId: shipment.reference,
        unitType: "co",
        weight: shipment.weightKg,
      },
    ],
    labelType,
    addresses: {
      deliveryAddress: {
        name1: shipment.name,
        street: shipment.street,
        houseNo: shipment.houseNo,
        zipCode: shipment.zipCode,
        city: shipment.city,
        countryCode: shipment.countryCode,
        phone: shipment.phone,
        email: shipment.email,
        addresseeType: "p",
      },
    },
  };

  const response = await postGlsApi("/Label/Create", requestBody);
  const json = response.json as ApiCreateLabelResponse | null;

  if (response.httpStatus !== 200) {
    throw new GlsApiError(
      json?.message ?? `GLS API returned HTTP ${response.httpStatus}`,
      response.httpStatus,
      json?.status,
      json?.errors,
    );
  }

  if (!json) {
    throw new GlsApiError(
      `GLS API returned a non-JSON response: ${response.text}`,
      response.httpStatus,
    );
  }

  if (json.error) {
    throw new GlsApiError(
      json.message ?? "GLS API reported an error",
      response.httpStatus,
      json.status,
      json.errors,
    );
  }

  if (!json.labels || !json.shipmentTrackingLink || !json.transactionId) {
    throw new GlsApiError(
      "GLS API response is missing expected label fields",
      response.httpStatus,
    );
  }

  return {
    label: json.labels,
    trackingLink: json.shipmentTrackingLink,
    unitTrackingLink: json.units?.[0]?.unitTrackingLink ?? "",
    transactionId: json.transactionId,
  };
}
