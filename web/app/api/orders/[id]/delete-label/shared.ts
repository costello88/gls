import { NextResponse } from "next/server";
import { deleteGlsLabel } from "../../../../../lib/gls/deleteLabel";
import { GlsApiError } from "../../../../../lib/gls/errors";

export async function handleDeleteLabel(request: Request): Promise<Response> {
  const { unitNo } = (await request.json()) as { unitNo: string };

  try {
    await deleteGlsLabel(unitNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GlsApiError) {
      return NextResponse.json({ error: err.message, details: err.glsErrors }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
