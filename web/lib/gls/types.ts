export interface NormalizedShipment {
  name: string;
  street: string;
  houseNo?: string;
  zipCode: string;
  city: string;
  countryCode: "BE" | "NL" | "LU";
  phone?: string;
  email?: string;
  weightKg: number;
  reference: string;
}

export type LabelType = "pdf" | "pdfA6U" | "zpl" | "zpl300";

export interface CreateLabelResult {
  label: string;
  trackingLink: string;
  unitTrackingLink: string;
  transactionId: string;
}
