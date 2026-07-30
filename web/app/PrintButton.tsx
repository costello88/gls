"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrintButton({
  orderId,
  label = "Download CSV",
  confirmMessage,
}: {
  orderId: string;
  label?: string;
  confirmMessage?: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    if (confirmMessage && !window.confirm(confirmMessage)) {
      return;
    }
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/print`, { method: "POST" });
    setLoading(false);

    if (!response.ok) {
      const body = (await response.json().catch(() => null)) as { error?: string } | null;
      setError(body?.error ?? "Exporteren mislukt");
      return;
    }

    const csv = await response.text();
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `gls-import-${orderId}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : label}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
