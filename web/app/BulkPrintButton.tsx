"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OrderSummary {
  id: string;
  name: string;
}

interface BulkPrintResult {
  id: string;
  name: string;
  success: boolean;
  labelUrl?: string;
  error?: string;
}

function base64ToBlobUrl(base64: string): string {
  const byteCharacters = atob(base64);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
  return URL.createObjectURL(blob);
}

export function BulkPrintButton({ orders }: { orders: OrderSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BulkPrintResult[] | null>(null);

  async function handleClick() {
    setLoading(true);
    setResults([]);

    for (const order of orders) {
      let result: BulkPrintResult;
      try {
        const response = await fetch(`/api/orders/${order.id}/print`, { method: "POST" });
        const body = (await response.json()) as { label?: string; error?: string };
        result =
          response.ok && body.label
            ? { id: order.id, name: order.name, success: true, labelUrl: base64ToBlobUrl(body.label) }
            : { id: order.id, name: order.name, success: false, error: body.error ?? "Printen mislukt" };
      } catch (err) {
        result = {
          id: order.id,
          name: order.name,
          success: false,
          error: (err as Error).message || "Printen mislukt",
        };
      }
      setResults((prev) => [...(prev ?? []), result]);
    }

    setLoading(false);
    router.refresh();
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
