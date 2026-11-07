import crypto from "node:crypto";
import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { catalog } from "@/lib/config";
import { stripe, stripeConfigured } from "@/lib/stripe";
import { visitorCountry, chargeCurrencyFor } from "@/lib/geo";
export const dynamic = "force-dynamic";

/** Creates a Stripe Checkout Session for a plan (INR; UPI/cards/netbanking as enabled in the Stripe dashboard). */
export const POST = withAuth(async (req: Request) => {
  const user = await requireUser();
  if (!stripeConfigured()) return badRequest("Payments are not configured yet.");
  const { planId } = (await req.json().catch(() => ({}))) as { planId?: string };
  const plan = (await catalog()).plans.find((p) => p.id === planId && p.priceUsd > 0);
  if (!plan) return badRequest("Unknown plan");
  const currency = chargeCurrencyFor(await visitorCountry());
  const amount = currency === "INR" ? plan.priceInr : plan.priceUsd; // paise or cents
  const origin = process.env.APP_URL || new URL(req.url).origin;
  const payment = await prisma.payment.create({ data: { userId: user.id, planId: plan.id, amount, currency, credits: plan.credits, provider: "stripe", orderId: `pending_${crypto.randomUUID()}` } });
  try {
    const session = await stripe<{ id: string; url: string }>("checkout/sessions", {
      mode: "payment", "line_items[0][quantity]": 1, "line_items[0][price_data][currency]": currency.toLowerCase(), "line_items[0][price_data][unit_amount]": amount,
      "line_items[0][price_data][product_data][name]": `Y2ube ${plan.name} — ${plan.credits.toLocaleString()} credits`,
      customer_email: user.email || undefined, client_reference_id: payment.id, "metadata[paymentId]": payment.id, "metadata[userId]": user.id, "metadata[planId]": plan.id,
      success_url: `${origin}/billing?paid=1&session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/billing?cancelled=1`,
    });
    await prisma.payment.update({ where: { id: payment.id }, data: { orderId: session.id } });
    return json({ url: session.url, currency });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Failed to create checkout session";
    console.error("Stripe Checkout error:", message);
    await prisma.payment.update({ where: { id: payment.id }, data: { status: "failed" } }).catch(() => {});
    return badRequest(message);
  }
});
