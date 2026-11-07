import { prisma } from "@vidforge/db";
import { catalog } from "@/lib/config";
import { postLedger } from "@/lib/credits";

/** Marks an order paid, grants credits and sets the plan. Safe to call twice (webhook + verify). */
export async function applyPaidOrder(orderId: string, paymentRef: string) {
  const payment = await prisma.payment.findUnique({ where: { orderId } });
  if (!payment) throw new Error("order not found");
  if (payment.status === "paid") return { alreadyApplied: true, credits: payment.credits, plan: payment.planId };
  const plan = (await catalog()).plans.find((p) => p.id === payment.planId);
  await prisma.payment.update({ where: { orderId }, data: { status: "paid", paymentRef, paidAt: new Date() } });
  await postLedger(payment.userId, "PURCHASE", payment.credits, { paymentId: payment.id, reason: `${plan?.name ?? payment.planId} plan` });
  const expires = new Date(); expires.setDate(expires.getDate() + 30);
  await prisma.user.update({ where: { id: payment.userId }, data: { plan: payment.planId, planExpiresAt: plan?.monthly ? expires : null } });
  return { alreadyApplied: false, credits: payment.credits, plan: payment.planId };
}
