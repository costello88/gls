"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function DeleteStoreButton({ storeId, storeName }: { storeId: string; storeName: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    const confirmed = window.confirm(
      `Weet je zeker dat je "${storeName}" wilt verwijderen? De bestellingen van deze winkel worden ook verwijderd. Dit kan niet ongedaan worden gemaakt.`,
    );
    if (!confirmed) {
      return;
    }
    setLoading(true);
    await fetch(`/api/stores/${storeId}`, { method: "DELETE" });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="text-sm font-medium text-red-600 hover:underline disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "Bezig..." : "Verwijderen"}
    </button>
  );
}
