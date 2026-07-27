import { NextResponse } from "next/server";
import { bulkDeleteLabels } from "../../../../lib/gls/bulkDeleteLabels";

export async function handleBulkDelete(request: Request): Promise<Response> {
  const { unitNos } = (await request.json()) as { unitNos: string[] };
  const results = await bulkDeleteLabels(unitNos);
  return NextResponse.json({ results });
}
