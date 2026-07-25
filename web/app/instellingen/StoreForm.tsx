"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded border border-slate-300 px-3 py-2 text-sm focus:border-yellow-400 focus:outline-none focus:ring-1 focus:ring-yellow-400";
const labelClass = "mb-1 block text-sm font-medium text-slate-700";

export function StoreForm() {
  const router = useRouter();
  const [type, setType] = useState<"SHOPIFY" | "WOOCOMMERCE">("SHOPIFY");
  const [name, setName] = useState("");
  const [customerNo, setCustomerNo] = useState("");
  const [defaultWeightKg, setDefaultWeightKg] = useState("1.0");
  const [shopDomain, setShopDomain] = useState("");
  const [shopifyAccessToken, setShopifyAccessToken] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [wooConsumerKey, setWooConsumerKey] = useState("");
  const [wooConsumerSecret, setWooConsumerSecret] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError(null);

    const input =
      type === "SHOPIFY"
        ? { type, name, customerNo, defaultWeightKg: Number(defaultWeightKg), shopDomain, shopifyAccessToken }
        : { type, name, customerNo, defaultWeightKg: Number(defaultWeightKg), siteUrl, wooConsumerKey, wooConsumerSecret };

    const response = await fetch("/api/stores", {
      method: "POST",
      body: JSON.stringify(input),
    });
    const body = (await response.json()) as { error?: string };

    if (!response.ok) {
      setError(body.error ?? "Opslaan mislukt");
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="block">
        <span className={labelClass}>Type</span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as "SHOPIFY" | "WOOCOMMERCE")}
          className={inputClass}
        >
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </label>
      <label className="block">
        <span className={labelClass}>Naam</span>
        <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>GLS klantnummer</span>
        <input value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} className={inputClass} />
      </label>
      <label className="block">
        <span className={labelClass}>Standaard gewicht (kg)</span>
        <input value={defaultWeightKg} onChange={(e) => setDefaultWeightKg(e.target.value)} className={inputClass} />
      </label>
      {type === "SHOPIFY" ? (
        <>
          <label className="block">
            <span className={labelClass}>Shopify domein</span>
            <input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Access token</span>
            <input
              value={shopifyAccessToken}
              onChange={(e) => setShopifyAccessToken(e.target.value)}
              className={inputClass}
            />
          </label>
        </>
      ) : (
        <>
          <label className="block">
            <span className={labelClass}>Site URL</span>
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} className={inputClass} />
          </label>
          <label className="block">
            <span className={labelClass}>Consumer key</span>
            <input
              value={wooConsumerKey}
              onChange={(e) => setWooConsumerKey(e.target.value)}
              className={inputClass}
            />
          </label>
          <label className="block">
            <span className={labelClass}>Consumer secret</span>
            <input
              value={wooConsumerSecret}
              onChange={(e) => setWooConsumerSecret(e.target.value)}
              className={inputClass}
            />
          </label>
        </>
      )}
      <button
        type="submit"
        className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500"
      >
        Toevoegen
      </button>
      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}
