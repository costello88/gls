"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export function AutomationToggle({ storeId, enabled }: { storeId: string; enabled: boolean }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleClick() {
    setLoading(true);
    await fetch(`/api/stores/${storeId}`, {
      method: "PATCH",
      body: JSON.stringify({ automationEnabled: !enabled }),
    });
    setLoading(false);
    router.refresh();
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className={`relative h-6 w-11 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        enabled ? "bg-yellow-400" : "bg-slate-300"
      }`}
      aria-pressed={enabled}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
          enabled ? "translate-x-5" : "translate-x-0.5"
        }`}
      />
    </button>
  );
}
