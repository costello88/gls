"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ConfirmLabelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const unitNo = window.prompt(
      "GLS pakketnummer (unit-nummer) van dit label, te vinden in Track&Trace:",
    );
    if (!unitNo) {
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/confirm`, {
      method: "POST",
      body: JSON.stringify({ unitNo }),
    });
    const body = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      window.alert(body.error ?? "Bevestigen mislukt");
      return;
    }

    window.alert("Label bevestigd bij GLS.");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm font-medium text-slate-500 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : "Bevestig"}
    </button>
  );
}
