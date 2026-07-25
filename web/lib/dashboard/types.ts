import type { OrderRecordInput, OrderRepository } from "../ingest/types";

export type OrderRecordStatus = "PENDING" | "NEEDS_REVIEW" | "READY" | "PRINTED" | "ERROR";

export interface OrderRecord extends OrderRecordInput {
  id: string;
  status: OrderRecordStatus;
  label: string | null;
  trackingLink: string | null;
}

export interface OrderFilter {
  status?: OrderRecordStatus;
}

export interface OrderEdits {
  name?: string;
  street?: string;
  houseNo?: string;
  zipCode?: string;
  city?: string;
  countryCode?: string;
  phone?: string;
  email?: string;
}

export interface DashboardOrderRepository extends OrderRepository {
  list(filter: OrderFilter): Promise<OrderRecord[]>;
  get(id: string): Promise<OrderRecord | null>;
  update(
    id: string,
    fields: OrderEdits & { status: "PENDING" | "NEEDS_REVIEW"; reviewReason: string | null },
  ): Promise<OrderRecord>;
  markPrinted(id: string, label: string, trackingLink: string): Promise<OrderRecord>;
  markError(id: string, message: string): Promise<OrderRecord>;
}

export type StoreType = "SHOPIFY" | "WOOCOMMERCE";

export interface StoreRecord {
  id: string;
  type: StoreType;
  name: string;
  automationEnabled: boolean;
  customerNo: string;
  defaultWeightKg: number;
  shopDomain: string | null;
  shopifyAccessToken: string | null;
  siteUrl: string | null;
  wooConsumerKey: string | null;
  wooConsumerSecret: string | null;
}

export interface StoreInput {
  type: StoreType;
  name: string;
  customerNo: string;
  defaultWeightKg: number;
  automationEnabled?: boolean;
  shopDomain?: string;
  shopifyAccessToken?: string;
  siteUrl?: string;
  wooConsumerKey?: string;
  wooConsumerSecret?: string;
}

export interface StoreRepository {
  list(): Promise<StoreRecord[]>;
  get(id: string): Promise<StoreRecord | null>;
  create(input: StoreInput): Promise<StoreRecord>;
  update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord>;
}
