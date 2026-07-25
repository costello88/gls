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
    <form onSubmit={handleSubmit}>
      {(Object.keys(fields) as (keyof typeof fields)[]).map((key) => (
        <label key={key} style={{ display: "block", marginBottom: 8 }}>
          {key}
          <input value={fields[key]} onChange={set(key)} style={{ display: "block", width: "100%" }} />
        </label>
      ))}
      <button type="submit">Opslaan</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
