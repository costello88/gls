"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface OrderSummary {
  id: string;
  name: string;
}

export function BulkPrintButton({ orders }: { orders: OrderSummary[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<{ exported: number; failed: string[] } | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    setSummary(null);

    const response = await fetch("/api/orders/export-csv", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orders.map((order) => order.id) }),
    });

    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Exporteren mislukt");
      return;
    }

    const failedIds = (response.headers.get("X-Failed-Ids") ?? "").split(",").filter(Boolean);
    const failedNames = orders
      .filter((order) => failedIds.includes(order.id))
      .map((order) => order.name);

    const csv = await response.text();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "gls-import.csv";
    link.click();
    URL.revokeObjectURL(url);

    setSummary({ exported: orders.length - failedNames.length, failed: failedNames });
    router.refresh();
  }

  if (orders.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="inline-flex items-center gap-2 rounded border border-yellow-400 bg-white px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : `Download CSV (${orders.length})`}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
      {summary && (
        <span className="text-sm text-slate-600">
          {summary.exported} geëxporteerd
          {summary.failed.length > 0 && (
            <span className="text-red-600"> · mislukt: {summary.failed.join(", ")}</span>
          )}
        </span>
      )}
    </span>
  );
}
