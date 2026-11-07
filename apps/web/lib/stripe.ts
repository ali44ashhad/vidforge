import crypto from "node:crypto";

const KEY = () => (process.env.STRIPE_SECRET_KEY || "").trim();
export const stripeConfigured = () => !!KEY();

/** Minimal Stripe REST client (form-encoded), enough for Checkout Sessions. */
export async function stripe<T = Record<string, unknown>>(path: string, params?: Record<string, string | number | undefined>, method: "POST" | "GET" = params ? "POST" : "GET"): Promise<T> {
  const key = KEY();
  if (key.startsWith("pk_")) {
    throw new Error("STRIPE_SECRET_KEY in .env is set to a Publishable key (pk_...). You must use your Secret key (starts with sk_test_ or sk_live_).");
  }
  const body = params ? new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) : undefined;
  const r = await fetch(`https://api.stripe.com/v1/${path}`, { method, headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/x-www-form-urlencoded" }, body });
  const d = (await r.json()) as T & { error?: { message: string } };
  if (!r.ok) throw new Error(d.error?.message ?? `Stripe ${r.status}`);
  return d;
}

/** Verifies a Stripe-Signature header against the raw body (t=…,v1=…). */
export function verifyStripeSignature(rawBody: string, header: string | null, secret: string, toleranceSec = 300): boolean {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts.t); if (!t || Math.abs(Date.now() / 1000 - t) > toleranceSec) return false;
  const expected = crypto.createHmac("sha256", secret).update(`${t}.${rawBody}`).digest("hex");
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  return sigs.some((s) => s.length === expected.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(expected)));
}
