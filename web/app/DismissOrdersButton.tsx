"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DismissOrdersButton({ orderIds }: { orderIds: string[] }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmed = window.confirm(
      `Weet je zeker dat je deze ${orderIds.length} bestellingen wilt afvinken?\n\n` +
        "Ze verdwijnen uit de lijst en komen ook bij een volgende synchronisatie niet meer terug. " +
        "Gebruik dit alleen voor bestellingen die al verstuurd zijn of die je nooit wilt versturen.",
    );
    if (!confirmed) {
      return;
    }

    setLoading(true);
    await fetch("/api/orders/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ids: orderIds }),
    });
    setLoading(false);
    router.refresh();
  }

  if (orderIds.length === 0) {
    return null;
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : `Afvinken (${orderIds.length})`}
    </button>
  );
}
