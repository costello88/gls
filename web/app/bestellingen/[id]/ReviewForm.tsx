"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { checkOrder } from "../../../lib/validate";
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
  const [submitting, setSubmitting] = useState(false);

  const reasons = checkOrder({
    email: fields.email,
    phone: fields.phone,
    countryCode: fields.countryCode,
  });

  function set(key: keyof typeof fields) {
    return (event: React.ChangeEvent<HTMLInputElement>) =>
      setFields((prev) => ({ ...prev, [key]: event.target.value }));
  }

  async function submit(edits: Partial<typeof fields>): Promise<void> {
    setError(null);
    setSubmitting(true);
    const response = await fetch(`/api/orders/${order.id}`, {
      method: "PATCH",
      body: JSON.stringify(edits),
    });
    setSubmitting(false);
    const body = (await response.json()) as { order?: { status: string }; error?: string };

    if (!response.ok) {
      setError(body.error ?? "Opslaan mislukt");
      return;
    }

    router.push("/");
  }

  function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    void submit(fields);
  }

  function handleSkip() {
    void submit({});
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {reasons.length > 0 ? (
        <ul className="space-y-1 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-600">
          {reasons.map((reason) => (
            <li key={reason}>{reason}</li>
          ))}
        </ul>
      ) : (
        <p className="rounded border border-green-200 bg-green-50 p-3 text-sm text-green-700">
          Ziet er goed uit.
        </p>
      )}
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
      <div className="flex gap-3">
        <button
          type="submit"
          disabled={submitting}
          className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Opslaan
        </button>
        <button
          type="button"
          onClick={handleSkip}
          disabled={submitting}
          className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Overslaan
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
