"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { PreviewOrder } from "../lib/ingest/preview";

type SelectableOrder = PreviewOrder & { selected: boolean };

function formatDate(iso: string): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString("nl-BE", { dateStyle: "medium", timeStyle: "short" });
}

export function SyncButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [orders, setOrders] = useState<SelectableOrder[] | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);

  async function handleClick() {
    setLoading(true);
    setMessage(null);
    const response = await fetch("/api/sync/preview");
    const body = (await response.json()) as { orders?: PreviewOrder[] };
    setLoading(false);

    const found = body.orders ?? [];
    if (found.length === 0) {
      setMessage("Geen nieuwe bestellingen gevonden.");
      return;
    }

    setOrders(found.map((order) => ({ ...order, selected: true })));
  }

  function toggleOrder(storeId: string, sourceOrderId: string) {
    setOrders((prev) =>
      prev
        ? prev.map((order) =>
            order.storeId === storeId && order.sourceOrderId === sourceOrderId
              ? { ...order, selected: !order.selected }
              : order,
          )
        : prev,
    );
  }

  function toggleAll(selected: boolean) {
    setOrders((prev) => (prev ? prev.map((order) => ({ ...order, selected })) : prev));
  }

  async function handleConfirm() {
    if (!orders) return;
    setConfirming(true);
    await fetch("/api/sync/confirm", {
      method: "POST",
      body: JSON.stringify({ orders }),
    });
    setConfirming(false);
    setOrders(null);
    router.refresh();
  }

  return (
    <>
      <span className="inline-flex items-center gap-2">
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
        {message && <span className="text-sm text-slate-500">{message}</span>}
      </span>

      {orders && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="flex max-h-[80vh] w-full max-w-2xl flex-col overflow-hidden rounded-lg bg-white shadow-lg">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-lg font-semibold text-slate-900">Bestellingen selecteren</h2>
              <div className="flex gap-3 text-sm font-medium text-blue-600">
                <button onClick={() => toggleAll(true)} className="hover:underline">
                  Alles selecteren
                </button>
                <button onClick={() => toggleAll(false)} className="hover:underline">
                  Alles deselecteren
                </button>
              </div>
            </div>
            <div className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {orders.map((order) => (
                <label
                  key={`${order.storeId}-${order.sourceOrderId}`}
                  className="flex items-center gap-3 px-6 py-3 hover:bg-slate-50"
                >
                  <input
                    type="checkbox"
                    checked={order.selected}
                    onChange={() => toggleOrder(order.storeId, order.sourceOrderId)}
                    className="h-4 w-4 rounded border-slate-300"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-slate-900">{order.name}</div>
                    <div className="text-xs text-slate-500">
                      {order.storeName} &middot; {formatDate(order.orderDate)}
                    </div>
                  </div>
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t border-slate-200 px-6 py-4">
              <button
                onClick={() => setOrders(null)}
                disabled={confirming}
                className="rounded border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Annuleren
              </button>
              <button
                onClick={handleConfirm}
                disabled={confirming}
                className="rounded bg-yellow-400 px-4 py-2 text-sm font-medium text-black transition-colors hover:bg-yellow-500 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {confirming ? "Bezig..." : "Importeren"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
