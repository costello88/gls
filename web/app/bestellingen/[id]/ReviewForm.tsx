"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { OrderRecord } from "../../../lib/dashboard/types";

export function ReviewForm({ order }: { order: OrderRecord }) {
  const router = useRouter();
  const [fields, setFields] = useState({
    name: order.name,
    street: order.street,
    houseNo: order.houseNo,
    zipCode: order.zipCode,
    city: order.city,
    countryCode: order.countryCode,
    phone: order.phone,
    email: order.email,
  });
  const [error, setError] = useState<string | null>(null);

  function set(key: keyof typeof fields) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      body: JSON.stringify(fields),
    });
    const body = (await response.json()) as { order?: { status: string }; error?: string };

    if (!response.ok) {
      setError(body.error ?? "Opslaan mislukt");
      return;
    }

    router.push("/");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
        <label key={key} className="block">
          <span className="mb-1 block text-sm font-medium text-slate-700">{key}</span>
          <input
            value={fields[key]}
            onChange={set(key)}
            className="w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400"
          />
        </label>
      ))}
      <button
        type="submit"
        className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
      >
        Opslaan
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
