import { handleDeleteLabel } from "./shared";

export async function POST(request: Request): Promise<Response> {
  return handleDeleteLabel(request);
}
