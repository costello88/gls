"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrintButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/print`, { method: "POST" });
    const body = (await response.json()) as { label?: string; error?: string };
    setLoading(false);

    if (!response.ok || !body.label) {
      setError(body.error ?? "Printen mislukt");
      return;
    }

    const byteCharacters = atob(body.label);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: "application/pdf" });
    window.open(URL.createObjectURL(blob), "_blank");
    router.refresh();
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded bg-yellow-400 px-3 py-1.5 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : "Printen"}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
