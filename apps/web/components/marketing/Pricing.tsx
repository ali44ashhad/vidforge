import Link from "next/link";
import { Check } from "lucide-react";
import { formatUsd, formatInr, type Plan } from "@vidforge/shared";
import Section from "./Section";
import Tilt from "./Tilt";

export default function Pricing({ plans, country = "US" }: { plans: Plan[]; country?: string }) {
  const shown = plans.filter((p) => p.priceUsd > 0).slice(0, 3);
  const free = plans.find((p) => p.priceUsd === 0);
  const inr = country === "IN";
  return (
    <Section id="pricing" title="Simple, transparent pricing." sub="Choose the plan that fits your creator journey. Every plan starts free with 60 credits." className="bg-panel/40" depth>
      <div className="stagger mx-auto grid max-w-5xl gap-4 md:grid-cols-3">
        {shown.map((p) => (
          <Tilt key={p.id} max={5} className={`relative flex flex-col rounded-3xl border p-6 ${p.popular ? "border-accent bg-accent/5 shadow-[0_0_0_1px_rgba(115,87,255,.5),0_20px_60px_rgba(115,87,255,.15)]" : "border-line bg-panel"}`}>
            {p.popular && <span className="absolute -top-3 right-5 rounded-full bg-energy px-3 py-1 text-xs font-semibold text-black">Most popular</span>}
            <div className="display text-xl font-bold">{p.name}</div>
            <div className="text-sm text-ink-3">{p.features[0]}</div>
            <div className="mt-5 display text-4xl font-bold sm:text-5xl">{formatUsd(p.priceUsd)}<span className="text-base font-normal text-ink-3">/month</span></div>
            {inr && <div className="text-[12px] text-ink-3">≈ {formatInr(p.priceInr)} · pay in INR with UPI</div>}
            <ul className="mt-5 flex-1 space-y-2 text-sm text-ink-2">{p.features.slice(1).map((f) => <li key={f} className="flex gap-2"><Check size={16} className="shrink-0 text-success" />{f}</li>)}</ul>
            <Link href="/signup" className={`mt-6 text-center ${p.popular ? "btn-primary" : "btn-ghost"}`}>Start free</Link>
          </Tilt>
        ))}
      </div>
      {free && <p className="mt-5 text-center text-sm text-ink-3">{free.name} plan: {free.credits} credits to try, no card required.</p>}
    </Section>
  );
}
