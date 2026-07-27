import { handleBulkDelete } from "./shared";

export async function POST(request: Request): Promise<Response> {
  return handleBulkDelete(request);
}
