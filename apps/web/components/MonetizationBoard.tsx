"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check, Coins, ArrowRight, Youtube } from "lucide-react";
import type { Overview } from "@/lib/analytics";
import { buildRequirements, type MonetizationRequirement } from "@/lib/monetization";
import { Skeleton } from "@/components/ui/Card";

export default function MonetizationBoard({ videos90d, readiness }: { videos90d: number; readiness: { label: string; ok: boolean; hint: string }[] }) {
  const [d, setD] = useState<Overview | null>(null);
  useEffect(() => { fetch("/api/analytics?days=28").then((r) => r.json()).then(setD); }, []);
  if (!d) return <Skeleton className="h-64" />;
  const reqs = buildRequirements({ subscribers: d.channel?.subscribers ?? 0, watchHours365: d.watchHours365, videosPublished90d: videos90d, connected: d.connected && !d.demo });
  const pct = Math.round((reqs.reduce((a, r) => a + Math.min(1, r.current / r.target), 0) / reqs.length) * 100);
  const next = nextAction(reqs, d);
  return (
    <div>
      <div className="mb-6"><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Monetization Roadmap</h1><p className="mt-1 text-[15px] text-ink-2">Track your progress and understand what to focus on next.</p></div>
      {d.demo && <div className="mb-5 rounded-xl border border-warning/40 bg-warning/5 p-4 text-[14px]"><span className="flex items-center gap-2"><Youtube size={16} className="text-danger" /> Sample numbers — <a href="/api/youtube/connect" className="underline">connect YouTube</a> to track your real channel.</span></div>}
      <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
        <div className="rounded-2xl border border-line bg-panel p-6 text-center">
          <div className="relative mx-auto h-44 w-44 rounded-full" style={{ background: `conic-gradient(#31D583 0 ${pct}%, rgba(255,255,255,.08) ${pct}% 100%)` }}><div className="absolute inset-3 flex flex-col items-center justify-center rounded-full bg-panel"><div className="display text-4xl font-bold">{pct}%</div><div className="text-[12px] text-ink-3">ready</div></div></div>
          <p className="mt-4 text-[13px] text-ink-3">Average progress across the requirements below.</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">{reqs.map((r) => <Req key={r.id} r={r} />)}</div>
      </div>
      <div className="mt-6 rounded-2xl border border-accent/40 bg-accent/10 p-6">
        <div className="flex items-center gap-2 text-[15px] font-semibold"><Coins size={16} className="text-accent" /> Your next best action</div>
        <p className="mt-2 text-[16px]">{next.text}</p>
        <div className="mt-4 flex flex-wrap gap-2"><Link href={next.href} className="btn-gradient flex items-center gap-2 text-[14px]">{next.cta} <ArrowRight size={14} /></Link><Link href="/content-plan" className="btn-ghost text-[14px]">View content plan</Link><Link href="/academy" className="btn-ghost text-[14px]">Learn about monetization</Link></div>
      </div>
      <div className="mt-6 rounded-2xl border border-line bg-panel p-5">
        <h2 className="text-[15px] font-semibold">Y2ube Channel Readiness</h2>
        <ul className="mt-3 grid gap-2 sm:grid-cols-2">{readiness.map((c) => <li key={c.label} className="flex items-start gap-2 rounded-xl border border-line p-3 text-[14px]"><span className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full ${c.ok ? "bg-success/20 text-success" : "bg-white/8 text-ink-3"}`}><Check size={12} /></span><div><div className="font-medium">{c.label}</div><div className="text-[12px] text-ink-3">{c.hint}</div></div></li>)}</ul>
        <p className="mt-3 text-[12px] text-ink-3">Y2ube readiness guidance is informational and does not guarantee YouTube Partner Program approval.</p>
      </div>
    </div>
  );
}

function Req({ r }: { r: MonetizationRequirement }) {
  const p = Math.min(100, Math.round((r.current / r.target) * 100));
  return <div className="rounded-2xl border border-line bg-panel p-5"><div className="flex items-center justify-between"><div className="text-[14px] font-semibold">{r.label}</div>{r.completed && <span className="pill pill-ready"><Check size={11} /> done</span>}</div><div className="mt-2 display text-[24px] font-bold tabular-nums">{r.current.toLocaleString()}<span className="text-[13px] font-normal text-ink-3"> / {r.target.toLocaleString()} {r.unit}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full rounded-full bg-gradient-to-r from-[#6650FF] to-[#31D583]" style={{ width: `${p}%` }} /></div>{r.note && <div className="mt-2 text-[12px] text-ink-3">{r.note}</div>}</div>;
}

function nextAction(reqs: MonetizationRequirement[], d: Overview) {
  const hours = reqs.find((r) => r.id === "hours")!, subs = reqs.find((r) => r.id === "subs")!, cons = reqs.find((r) => r.id === "consistency")!;
  if (!d.connected || d.demo) return { text: "Connect your YouTube channel so we can track real subscribers and watch hours.", cta: "Connect YouTube", href: "/api/youtube/connect" };
  if (!cons.completed) return { text: `Publish ${Math.max(1, cons.target - cons.current)} more videos in the next weeks to build consistency — 8–10 minute explainers earn the most watch time.`, cta: "Create recommended video", href: "/create?type=Explainer" };
  if (!hours.completed) return { text: `You need ${Math.max(0, hours.target - hours.current).toLocaleString()} more public watch hours. Longer videos on your best topics move this fastest.`, cta: "Create a long-form video", href: "/create?type=YouTube%20Documentary" };
  if (!subs.completed) return { text: `You need ${Math.max(0, subs.target - subs.current).toLocaleString()} more subscribers. Shorts drive subscriptions — publish 3 this week.`, cta: "Create a Short", href: "/create?type=Short" };
  return { text: "You meet the thresholds we track. Apply for the YouTube Partner Program in YouTube Studio and keep publishing.", cta: "Plan next videos", href: "/ideas" };
}
