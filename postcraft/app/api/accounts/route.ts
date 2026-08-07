import type { NextRequest } from "next/server";
import { jsonError, jsonOk, requireUser } from "@/lib/api";
import type { IgAccount } from "@/lib/types";

/** An account row as sent to the client: token stripped, expiry summarized. */
function toClientAccount(account: IgAccount) {
  const { access_token_enc: _token, ...safe } = account;
  const token_days_left = account.token_expires_at
    ? Math.max(0, Math.ceil((new Date(account.token_expires_at).getTime() - Date.now()) / 86_400_000))
    : null;
  return { ...safe, token_days_left };
}

export async function GET() {
  const { supa, error } = await requireUser();
  if (error) return error;

  const { data, error: dbError } = await supa
    .from("ig_accounts")
    .select("*")
    .order("connected_at", { ascending: true });
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ accounts: ((data ?? []) as IgAccount[]).map(toClientAccount) });
}

export async function DELETE(request: NextRequest) {
  const { supa, error } = await requireUser();
  if (error) return error;

  const id = new URL(request.url).searchParams.get("id");
  if (!id) return jsonError("Missing account id");

  const { error: dbError } = await supa.from("ig_accounts").delete().eq("id", id);
  if (dbError) return jsonError(dbError.message, 500);

  return jsonOk({ ok: true });
}
