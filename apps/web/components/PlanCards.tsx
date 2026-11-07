"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { formatUsd, formatInr, type Plan } from "@vidforge/shared";

/** Plan cards → Stripe Checkout (UPI, cards, netbanking as enabled in Stripe). */
export default function PlanCards({ current, plans, country = "US" }: { current: string; plans: Plan[]; country?: string }) {
  const inr = country === "IN";
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [yearly, setYearly] = useState(false);

  // returning from checkout: confirm with Stripe (fallback if the webhook is slow)
  useEffect(() => {
    const q = new URLSearchParams(window.location.search);
    if (q.get("paid") && q.get("session_id")) {
      setMsg("Confirming your payment…");
      fetch(`/api/billing/verify-stripe?session_id=${encodeURIComponent(q.get("session_id")!)}`).then((r) => r.json()).then((d) => { setMsg(d.paid ? `Payment received — ${d.credits?.toLocaleString?.() ?? ""} credits added to your account.` : "Payment is still processing; credits appear as soon as it clears."); router.replace("/billing"); router.refresh(); });
    } else if (q.get("cancelled")) { setMsg("Checkout cancelled — nothing was charged."); router.replace("/billing"); }
  }, [router]);

  async function buy(planId: string) {
    setBusy(planId); setMsg(null);
    const r = await fetch("/api/billing/checkout", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ planId }) });
    const d = await r.json();
    if (!r.ok || !d.url) { setMsg(d.error ?? "Could not start checkout"); setBusy(null); return; }
    window.location.href = d.url;
  }

  return (
    <section>
      <div className="mb-4 flex justify-center"><div className="flex gap-1 rounded-full border border-line p-1 text-[13px]"><button className={`rounded-full px-4 py-1.5 ${!yearly ? "bg-accent text-white" : "text-ink-2"}`} onClick={() => setYearly(false)}>Monthly</button><button className={`rounded-full px-4 py-1.5 ${yearly ? "bg-accent text-white" : "text-ink-2"}`} onClick={() => setYearly(true)} title="Yearly billing is coming soon">Yearly <span className="ml-1 rounded-full bg-success/20 px-1.5 text-[11px] text-success">soon</span></button></div></div>
      {msg && <p className="mb-4 rounded-xl border border-line bg-panel-2 px-4 py-2 text-center text-[14px]">{msg}</p>}
      <div className="grid gap-4 md:grid-cols-3 xl:grid-cols-5">
        {plans.map((p) => (
          <div key={p.id} className={`relative flex flex-col rounded-2xl border p-5 ${p.popular ? "border-accent bg-accent/5 shadow-[0_0_0_1px_rgba(108,76,255,.5)]" : current === p.id ? "border-line-2" : "border-line"}`}>
            {p.popular && <span className="absolute -top-3 right-4 rounded-full bg-warning px-2.5 py-0.5 text-[11px] font-semibold text-black">Most popular</span>}
            <div className="flex items-center justify-between"><h3 className="text-[16px] font-semibold">{p.name}</h3>{current === p.id && <span className="pill pill-ready">Current</span>}</div>
            <div className="mt-2 display text-[28px] font-bold">{formatUsd(p.priceUsd)}<span className="text-[13px] font-normal text-ink-3">{p.monthly && p.priceUsd ? " /month" : ""}</span></div>
            {inr && p.priceUsd > 0 && <div className="text-[12px] text-ink-3">Charged {formatInr(p.priceInr)} in INR · UPI, cards, netbanking</div>}
            <div className="text-[14px] text-ink-2">{p.credits.toLocaleString()} credits</div>
            <ul className="mt-3 flex-1 space-y-1 text-[13px] text-ink-3">{p.features.map((f) => <li key={f} className="flex gap-1.5"><Check size={13} className="mt-0.5 shrink-0 text-success" />{f}</li>)}</ul>
            {p.priceUsd > 0
              ? <button className={`mt-4 flex items-center justify-center gap-2 text-[14px] ${p.popular ? "btn-gradient" : "btn-ghost"}`} disabled={busy !== null || yearly} onClick={() => buy(p.id)}>{busy === p.id ? <><Loader2 size={14} className="animate-spin" /> Opening checkout…</> : current === p.id ? "Renew / top up" : `Get ${p.name}`}</button>
              : <span className="mt-4 text-center text-[13px] text-ink-3">{current === p.id ? "Your current plan" : "Included at sign-up"}</span>}
          </div>
        ))}
      </div>
      <p className="mt-3 text-center text-[12px] text-ink-3">Secure checkout by Stripe · {inr ? "you pay in INR (UPI, cards, netbanking)" : "you pay in USD by card"} · prices shown in USD</p>
    </section>
  );
}
