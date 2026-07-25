"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch("/api/sync", { method: "POST" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="inline-flex items-center gap-2 rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading && (
        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-black/30 border-t-black" />
      )}
      {loading ? "Bezig..." : "Bestellingen ophalen"}
    </button>
  );
}
