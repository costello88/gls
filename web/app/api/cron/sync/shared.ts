import { NextResponse } from "next/server";
import { runAutomatedSync } from "../../../../lib/automation/run";
import type { CreateLabelFn } from "../../../../lib/dashboard/orders";
import type { DashboardOrderRepository, StoreRepository } from "../../../../lib/dashboard/types";

export async function handleCronSync(
  request: Request,
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
  createLabelFn: CreateLabelFn,
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const results = await runAutomatedSync(storeRepo, orderRepo, createLabelFn);
  return NextResponse.json({ results });
}
