"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    <form onSubmit={handleSubmit}>
      <label style={{ display: "block", marginBottom: 8 }}>
        Type
        <select value={type} onChange={(e) => setType(e.target.value as "SHOPIFY" | "WOOCOMMERCE")}>
          <option value="SHOPIFY">Shopify</option>
          <option value="WOOCOMMERCE">WooCommerce</option>
        </select>
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Naam
        <input value={name} onChange={(e) => setName(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        GLS klantnummer
        <input value={customerNo} onChange={(e) => setCustomerNo(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      <label style={{ display: "block", marginBottom: 8 }}>
        Standaard gewicht (kg)
        <input value={defaultWeightKg} onChange={(e) => setDefaultWeightKg(e.target.value)} style={{ display: "block", width: "100%" }} />
      </label>
      {type === "SHOPIFY" ? (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            Shopify domein
            <input value={shopDomain} onChange={(e) => setShopDomain(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Access token
            <input value={shopifyAccessToken} onChange={(e) => setShopifyAccessToken(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
        </>
      ) : (
        <>
          <label style={{ display: "block", marginBottom: 8 }}>
            Site URL
            <input value={siteUrl} onChange={(e) => setSiteUrl(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Consumer key
            <input value={wooConsumerKey} onChange={(e) => setWooConsumerKey(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
          <label style={{ display: "block", marginBottom: 8 }}>
            Consumer secret
            <input value={wooConsumerSecret} onChange={(e) => setWooConsumerSecret(e.target.value)} style={{ display: "block", width: "100%" }} />
          </label>
        </>
      )}
      <button type="submit">Toevoegen</button>
      {error && <p style={{ color: "red" }}>{error}</p>}
    </form>
  );
}
