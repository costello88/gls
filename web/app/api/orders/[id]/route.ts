import { PrismaOrderRepository } from "../../../../lib/repositories/orderRepository";
import { handleReviewOrder } from "../shared";

const repository = new PrismaOrderRepository();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;
  return handleReviewOrder(request, repository, id);
}
