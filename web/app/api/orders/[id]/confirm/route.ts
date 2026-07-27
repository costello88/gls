import { handleConfirmLabel } from "./shared";

export async function POST(request: Request): Promise<Response> {
  return handleConfirmLabel(request);
}
