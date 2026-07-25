import { notFound } from "next/navigation";
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { ReviewForm } from "./ReviewForm";

export default async function ReviewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const repository = new PrismaOrderRepository();
  const order = await repository.get(id);

  if (!order) {
    notFound();
  }

  return (
    <main style={{ maxWidth: 480, margin: "40px auto", fontFamily: "sans-serif" }}>
      <h1>Bestelling controleren</h1>
      <p style={{ color: "red" }}>{order.reviewReason}</p>
      <ReviewForm order={order} />
    </main>
  );
}
