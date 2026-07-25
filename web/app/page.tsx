import Link from "next/link";
import { listOrders } from "../lib/dashboard/orders";
import { PrismaOrderRepository } from "../lib/repositories/orderRepository";
import type { OrderRecordStatus } from "../lib/dashboard/types";
import { AppShell } from "./components/AppShell";
import { StatusBadge } from "./components/StatusBadge";
import { SyncButton } from "./SyncButton";
import { PrintButton } from "./PrintButton";
import { ClearOrdersButton } from "./ClearOrdersButton";

const TABS: { label: string; status: OrderRecordStatus }[] = [
  { label: "Klaar om te printen", status: "PENDING" },
  { label: "Moet gecontroleerd worden", status: "NEEDS_REVIEW" },
  { label: "Geprint", status: "PRINTED" },
  { label: "Fout", status: "ERROR" },
];

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status } = await searchParams;
  const activeStatus = (status as OrderRecordStatus | undefined) ?? "PENDING";
  const repository = new PrismaOrderRepository();
  const orders = await listOrders(repository, { status: activeStatus });

  return (
    <AppShell>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex gap-2">
          {TABS.map((tab) => (
            <Link
              key={tab.status}
              href={`/?status=${tab.status}`}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                tab.status === activeStatus
                  ? "bg-yellow-400 text-black"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200"
              }`}
            >
              {tab.label}
            </Link>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <SyncButton />
          <ClearOrdersButton />
        </div>
      </div>

      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white">
        <table className="w-full text-left text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Naam</th>
              <th className="px-4 py-3">Adres</th>
              <th className="px-4 py-3">Land</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {orders.map((order) => (
              <tr key={order.id} className="even:bg-slate-50">
                <td className="px-4 py-3 font-medium text-slate-900">{order.name}</td>
                <td className="px-4 py-3 text-slate-600">
                  {order.street} {order.houseNo}, {order.zipCode} {order.city}
                </td>
                <td className="px-4 py-3 text-slate-600">{order.countryCode}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={order.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  {order.status === "NEEDS_REVIEW" && (
                    <Link
                      href={`/bestellingen/${order.id}`}
                      className="text-sm font-medium text-blue-600 hover:underline"
                    >
                      Bekijken
                    </Link>
                  )}
                  {(order.status === "PENDING" || order.status === "ERROR") && (
                    <PrintButton orderId={order.id} />
                  )}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-slate-400">
                  Geen bestellingen in deze categorie.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
