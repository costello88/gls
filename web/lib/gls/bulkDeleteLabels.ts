import { deleteGlsLabel } from "./deleteLabel";

export interface BulkDeleteResult {
  unitNo: string;
  success: boolean;
  error?: string;
}

export async function bulkDeleteLabels(unitNos: string[]): Promise<BulkDeleteResult[]> {
  const results: BulkDeleteResult[] = [];

  for (const unitNo of unitNos) {
    try {
      await deleteGlsLabel(unitNo);
      results.push({ unitNo, success: true });
    } catch (err) {
      results.push({ unitNo, success: false, error: (err as Error).message });
    }
  }

  return results;
}
