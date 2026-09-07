"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DismissOrdersButton({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const confirmed = window.confirm(
      `Weet je zeker dat je deze ${orderIds.length} bestellingen wilt afvinken?\n\n` +
        "Ze verdwijnen uit de lijst en komen ook bij een volgende synchronisatie niet meer terug. " +
        "Gebruik dit alleen voor bestellingen die al verstuurd zijn of die je nooit wilt versturen.",
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/orders/dismiss", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: orderIds }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => null)) as { error?: string } | null;
        setError(body?.error ?? `Afvinken mislukt (foutcode ${response.status})`);
        return;
      }
      router.refresh();
    } catch (err) {
      setError((err as Error).message || "Afvinken mislukt");
    } finally {
      setLoading(false);
    }
  }

  if (orderIds.length === 0) {
    return null;
  }

  return (
    <span className="inline-flex items-center gap-2">
      <button
        onClick={handleClick}
        disabled={loading}
        className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? "Bezig..." : `Afvinken (${orderIds.length})`}
      </button>
      {error && <span className="text-sm text-red-600">{error}</span>}
    </span>
  );
}
