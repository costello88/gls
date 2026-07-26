import { notFound } from "next/navigation";
import { PrismaOrderRepository } from "../../../lib/repositories/orderRepository";
import { AppShell } from "../../components/AppShell";
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
    <AppShell>
      <div className="mx-auto max-w-lg rounded-lg bg-white p-6 shadow-sm">
        <h1 className="mb-6 text-xl font-semibold text-slate-900">Bestelling controleren</h1>
        <ReviewForm order={order} />
      </div>
    </AppShell>
  );
}
