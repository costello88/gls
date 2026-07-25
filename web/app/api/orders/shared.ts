import { NextResponse } from "next/server";
import { GlsApiError } from "../../../lib/gls/errors";
import { clearOrders, listOrders, printOrder, reviewOrder, type CreateLabelFn } from "../../../lib/dashboard/orders";
import type { DashboardOrderRepository, OrderEdits, OrderFilter } from "../../../lib/dashboard/types";

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
  id: string,
  createLabelFn: CreateLabelFn,
): Promise<Response> {
  try {
    const result = await printOrder(repo, id, createLabelFn);
    return NextResponse.json(result);
  } catch (err) {
    if (err instanceof GlsApiError) {
      return NextResponse.json({ error: err.message }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}

export async function handleClearOrders(repo: DashboardOrderRepository): Promise<Response> {
  await clearOrders(repo);
  return NextResponse.json({ ok: true });
}
