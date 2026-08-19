export interface NormalizedOrderInput {
  sourceOrderId: string;
  orderNumber: string;
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
}

export interface SyncResult {
  new: number;
  valid: number;
  invalid: number;
  ignored: number;
  error?: string;
}

interface StoreConfigBase {
  id: string;
  defaultWeightKg: number;
  customerNo: string;
}

export type StoreConfig =
  | (StoreConfigBase & {
      type: "SHOPIFY";
      shopDomain: string;
      shopifyAccessToken: string;
    })
  | (StoreConfigBase & {
      type: "WOOCOMMERCE";
      siteUrl: string;
      wooConsumerKey: string;
      wooConsumerSecret: string;
    });

export interface OrderRecordInput {
  storeId: string;
  sourceOrderId: string;
  orderNumber: string;
  name: string;
  street: string;
  houseNo: string;
  zipCode: string;
  city: string;
  countryCode: string;
  phone: string;
  email: string;
  weightKg: number;
  customerNo: string;
  status: "PENDING" | "NEEDS_REVIEW" | "IGNORED";
  reviewReason: string | null;
}

export interface OrderRepository {
  exists(storeId: string, sourceOrderId: string): Promise<boolean>;
  create(order: OrderRecordInput): Promise<void>;
}
