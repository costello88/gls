"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteLabelButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const unitNo = window.prompt(
      "GLS pakketnummer (unit-nummer) van het label dat verwijderd moet worden, te vinden in Track&Trace:",
    );
    if (!unitNo) {
      return;
    }
    const confirmed = window.confirm(
      `Weet je zeker dat je zending ${unitNo} bij GLS wilt verwijderen? Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    const response = await fetch(`/api/orders/${orderId}/delete-label`, {
      method: "POST",
      body: JSON.stringify({ unitNo }),
    });
    const body = (await response.json()) as { error?: string };
    setLoading(false);

    if (!response.ok) {
      window.alert(body.error ?? "Verwijderen mislukt");
      return;
    }

    window.alert("Label verwijderd bij GLS.");
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : "Verwijder label"}
    </button>
  );
}
