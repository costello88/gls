import { jsonOk, requireUser } from "@/lib/api";
import { snapshotInsights } from "@/lib/insights/snapshot";
import type { IgAccount } from "@/lib/types";

export const maxDuration = 300;

/** Manual snapshot: same logic as the daily cron step, scoped to this user's accounts. */
export async function POST() {
  const { supa, error } = await requireUser();
  if (error) return error;

  const { data } = await supa.from("ig_accounts").select("*");
  const synced = await snapshotInsights((data ?? []) as IgAccount[], supa);

  return jsonOk({ synced });
}
