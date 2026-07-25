import { prisma } from "../db";
import type { StoreInput, StoreRecord, StoreRepository } from "../dashboard/types";

function toStoreRecord(store: {
  id: string;
  type: string;
  name: string;
  automationEnabled: boolean;
  customerNo: string;
  defaultWeightKg: number;
  shopDomain: string | null;
  shopifyAccessToken: string | null;
  siteUrl: string | null;
  wooConsumerKey: string | null;
  wooConsumerSecret: string | null;
}): StoreRecord {
  return { ...store, type: store.type as StoreRecord["type"] };
}

export class PrismaStoreRepository implements StoreRepository {
  async list(): Promise<StoreRecord[]> {
    const stores = await prisma.store.findMany({ orderBy: { createdAt: "desc" } });
    return stores.map(toStoreRecord);
  }

  async get(id: string): Promise<StoreRecord | null> {
    const store = await prisma.store.findUnique({ where: { id } });
    return store ? toStoreRecord(store) : null;
  }

  async create(input: StoreInput): Promise<StoreRecord> {
    const store = await prisma.store.create({ data: input });
    return toStoreRecord(store);
  }

  async update(id: string, edits: Partial<StoreInput>): Promise<StoreRecord> {
    const store = await prisma.store.update({ where: { id }, data: edits });
    return toStoreRecord(store);
  }
}
