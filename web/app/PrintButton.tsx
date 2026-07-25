"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function PrintButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setError(null);
    const response = await fetch(`/api/orders/${orderId}/print`, { method: "POST" });
    const body = (await response.json()) as { label?: string; error?: string };

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
    <>
      <button onClick={handleClick}>Printen</button>
      {error && <span style={{ color: "red", marginLeft: 8 }}>{error}</span>}
    </>
  );
}
