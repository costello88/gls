"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function ClearOrdersButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmed = window.confirm(
      "Weet je zeker dat je alle bestellingen wilt verwijderen? Dit kan niet ongedaan worden gemaakt.",
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    await fetch("/api/orders", { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="rounded border border-red-300 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : "Wis alles"}
    </button>
  );
}
