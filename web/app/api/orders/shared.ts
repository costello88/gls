import { NextResponse } from "next/server";
import { clearOrders, exportOrders, listOrders, printOrder, reviewOrder } from "../../../lib/dashboard/orders";
import type {
  DashboardOrderRepository,
  OrderEdits,
  OrderFilter,
  StoreRepository,
} from "../../../lib/dashboard/types";

export async function handleListOrders(
  request: Request,
  repo: DashboardOrderRepository,
): Promise<Response> {
  const url = new URL(request.url);
  const status = url.searchParams.get("status") as OrderFilter["status"] | null;
  const orders = await listOrders(repo, status ? { status } : {});
  return NextResponse.json({ orders });
}

export async function handleReviewOrder(
  request: Request,
  repo: DashboardOrderRepository,
  id: string,
): Promise<Response> {
  const edits = (await request.json()) as OrderEdits;
  const order = await reviewOrder(repo, id, edits);
  return NextResponse.json({ order });
}

export async function handlePrintOrder(
  repo: DashboardOrderRepository,
  storeRepo: StoreRepository,
  id: string,
): Promise<Response> {
  try {
    const result = await printOrder(repo, storeRepo, id);
    return new NextResponse(result.csv, {
      headers: {
        "Content-Type": "text/csv",
        "Content-Disposition": `attachment; filename="gls-import-${id}.csv"`,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function handleExportOrders(
  request: Request,
  repo: DashboardOrderRepository,
  storeRepo: StoreRepository,
): Promise<Response> {
  const { ids } = (await request.json()) as { ids: string[] };
  const result = await exportOrders(repo, storeRepo, ids);
  return new NextResponse(result.csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="gls-import.csv"`,
      "X-Failed-Ids": result.failed.join(","),
    },
  });
}

export async function handleClearOrders(repo: DashboardOrderRepository): Promise<Response> {
  await clearOrders(repo);
  return NextResponse.json({ ok: true });
}
