"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PDFDocument } from "pdf-lib";

interface OrderSummary {
  id: string;
  name: string;
}

interface BulkPrintResult {
  id: string;
  name: string;
  success: boolean;
  label?: string;
  labelUrl?: string;
  error?: string;
}

function base64ToBytes(base64: string): Uint8Array {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  return new Uint8Array(byteNumbers);
}

function base64ToBlobUrl(base64: string): string {
  const blob = new Blob([base64ToBytes(base64) as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

async function mergeLabels(labels: string[]): Promise<string> {
  const mergedPdf = await PDFDocument.create();
  for (const label of labels) {
    const doc = await PDFDocument.load(base64ToBytes(label));
    const pages = await mergedPdf.copyPages(doc, doc.getPageIndices());
    pages.forEach((page) => mergedPdf.addPage(page));
  }
  const mergedBytes = await mergedPdf.save();
  const blob = new Blob([mergedBytes as BlobPart], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export function BulkPrintButton({ orders }: { orders: OrderSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkPrintResult[] | null>(null);
  const [mergedUrl, setMergedUrl] = useState<string | null>(null);
  const [merging, setMerging] = useState(false);

  async function handleClick() {
    setLoading(true);
    setResults([]);
    setMergedUrl(null);
    const collected: BulkPrintResult[] = [];

    for (const order of orders) {
      let result: BulkPrintResult;
      try {
        const response = await fetch(`/api/orders/${order.id}/print`, { method: "POST" });
        const body = (await response.json()) as { label?: string; error?: string };
        result =
          response.ok && body.label
            ? {
                id: order.id,
                name: order.name,
                success: true,
                label: body.label,
                labelUrl: base64ToBlobUrl(body.label),
              }
            : { id: order.id, name: order.name, success: false, error: body.error ?? "Printen mislukt" };
      } catch (err) {
        result = {
          id: order.id,
          name: order.name,
          success: false,
          error: (err as Error).message || "Printen mislukt",
        };
      }
      collected.push(result);
      setResults((prev) => [...(prev ?? []), result]);
    }

    setLoading(false);
    router.refresh();

    const successfulLabels = collected.filter((r) => r.success && r.label).map((r) => r.label!);
    if (successfulLabels.length > 0) {
      setMerging(true);
      const url = await mergeLabels(successfulLabels);
      setMerging(false);
      setMergedUrl(url);
    }
  }

  if (orders.length === 0) {
    return null;
  }

  return (
    <>
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded border border-yellow-400 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : `Print alles (${orders.length})`}
      </button>

      {results && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">
                {results.filter((r) => r.success).length} geprint, {results.filter((r) => !r.success).length} mislukt
              </h2>
              <button
                onClick={() => setResults(null)}
                className="text-sm font-medium text-slate-500 hover:text-slate-700"
              >
                Sluiten
              </button>
            </div>

            {!loading && (
              <div className="border-b border-slate-200 px-6 py-3">
                {merging && <p className="text-sm text-slate-500">Labels samenvoegen...</p>}
                {mergedUrl && (
                  <a
                    href={mergedUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
                  >
                    Open alle labels ({results.filter((r) => r.success).length})
                  </a>
                )}
              </div>
            )}

            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {results.map((result) => (
                <div key={result.id} className="flex items-center justify-between px-6 py-3">
                  <span className="text-sm font-medium text-slate-900">{result.name}</span>
                  {result.success ? (
                    <a
                      href={result.labelUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Bekijk label
                    </a>
                  ) : (
                    <span className="text-sm text-red-600">{result.error}</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
