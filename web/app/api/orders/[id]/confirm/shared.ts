import { NextResponse } from "next/server";
import { confirmGlsLabel } from "../../../../../lib/gls/confirmLabel";
import { GlsApiError } from "../../../../../lib/gls/errors";

export async function handleConfirmLabel(request: Request): Promise<Response> {
  const { unitNo } = (await request.json()) as { unitNo: string };

  try {
    await confirmGlsLabel(unitNo);
    return NextResponse.json({ ok: true });
  } catch (err) {
    if (err instanceof GlsApiError) {
      return NextResponse.json({ error: err.message, details: err.glsErrors }, { status: 502 });
    }
    return NextResponse.json({ error: (err as Error).message }, { status: 500 });
  }
}
