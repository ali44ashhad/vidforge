import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { applyPaidOrder } from "@/lib/billing";
import { stripe } from "@/lib/stripe";
import { prisma } from "@vidforge/db";
export const dynamic = "force-dynamic";

/** Return-from-checkout fallback: confirms the session with Stripe and applies it if the webhook hasn't yet. */
export const GET = withAuth(async (req: Request) => {
  const user = await requireUser();
  const id = new URL(req.url).searchParams.get("session_id");
  if (!id) return badRequest("session_id required");
  const own = await prisma.payment.findUnique({ where: { orderId: id } });
  if (!own || own.userId !== user.id) return badRequest("Unknown session");
  const s = await stripe<{ id: string; payment_status: string; payment_intent?: string }>(`checkout/sessions/${id}`);
  if (s.payment_status !== "paid") return json({ paid: false, status: s.payment_status });
  const r = await applyPaidOrder(s.id, String(s.payment_intent ?? s.id));
  return json({ paid: true, ...r });
});
