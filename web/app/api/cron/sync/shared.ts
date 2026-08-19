import { NextResponse } from "next/server";
import { runAutomatedSync } from "../../../../lib/automation/run";
import type { DashboardOrderRepository, StoreRepository } from "../../../../lib/dashboard/types";

export async function handleCronSync(
  request: Request,
  storeRepo: StoreRepository,
  orderRepo: DashboardOrderRepository,
): Promise<Response> {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const result = await runAutomatedSync(storeRepo, orderRepo);
  return NextResponse.json(result);
}
