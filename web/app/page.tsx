import Link from "next/link";
import { listOrders } from "../lib/dashboard/orders";
import { PrismaOrderRepository } from "../lib/repositories/orderRepository";
import type { OrderRecordStatus } from "../lib/dashboard/types";
import { SyncButton } from "./SyncButton";
import { PrintButton } from "./PrintButton";

const TABS: { label: string; status: OrderRecordStatus }[] = [
  { label: "Klaar om te printen", status: "PENDING" },
  { label: "Moet gecontroleerd worden", status: "NEEDS_REVIEW" },
  { label: "Geprint", status: "PRINTED" },
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
    <main style={{ maxWidth: 960, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>GLS Sync</h1>
      <nav style={{ marginBottom: 16 }}>
        {TABS.map((tab) => (
          <Link
            key={tab.status}
            href={`/?status=${tab.status}`}
            style={{
              marginRight: 12,
              fontWeight: tab.status === activeStatus ? "bold" : "normal",
            }}
          >
            {tab.label}
          </Link>
        ))}
        <Link href="/instellingen" style={{ float: "right" }}>
          Instellingen
        </Link>
      </nav>
      <SyncButton />
      <table style={{ width: "100%", marginTop: 16, borderCollapse: "collapse" }}>
        <thead>
          <tr>
            <th style={{ textAlign: "left" }}>Naam</th>
            <th style={{ textAlign: "left" }}>Adres</th>
            <th style={{ textAlign: "left" }}>Land</th>
            <th style={{ textAlign: "left" }}>Status</th>
            <th />
          </tr>
        </thead>
        <tbody>
          {orders.map((order) => (
            <tr key={order.id}>
              <td>{order.name}</td>
              <td>
                {order.street} {order.houseNo}, {order.zipCode} {order.city}
              </td>
              <td>{order.countryCode}</td>
              <td>{order.status}</td>
              <td>
                {order.status === "NEEDS_REVIEW" && (
                  <Link href={`/bestellingen/${order.id}`}>Bekijken</Link>
                )}
                {order.status === "PENDING" && <PrintButton orderId={order.id} />}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
