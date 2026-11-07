import { json } from "@/lib/api";
import { applyPaidOrder } from "@/lib/billing";
import { verifyStripeSignature } from "@/lib/stripe";
export const dynamic = "force-dynamic";

/** Stripe → checkout.session.completed: grant credits (idempotent). Configure the endpoint URL + secret in the Stripe dashboard. */
export async function POST(req: Request) {
  const raw = await req.text();
  const secret = process.env.STRIPE_WEBHOOK_SECRET || "";
  if (!secret || !verifyStripeSignature(raw, req.headers.get("stripe-signature"), secret)) return json({ error: "bad signature" }, 400);
  const evt = JSON.parse(raw) as { type: string; data: { object: { id: string; payment_status?: string; payment_intent?: string } } };
  if (evt.type === "checkout.session.completed" || evt.type === "checkout.session.async_payment_succeeded") {
    const s = evt.data.object;
    if (s.payment_status === "paid") { try { await applyPaidOrder(s.id, String(s.payment_intent ?? s.id)); } catch (e) { console.error("stripe webhook apply failed", (e as Error).message); } }
  }
  return json({ received: true });
}
