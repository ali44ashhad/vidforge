"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Play, Camera, LayoutGrid, Youtube, Send, Check } from "lucide-react";
import VideoModal from "./VideoModal";
import HeroVisual from "./HeroVisual";
import Tilt from "./Tilt";
import { hero } from "@/lib/marketing";
import Logo from "@/components/Logo";

const ICONS = [Camera, LayoutGrid, Youtube, Send];

export default function Hero({ previewImage, demo }: { previewImage: string; demo: { url: string; title: string } | null }) {
  const [show, setShow] = useState(false);
  return (
    <section className="relative overflow-hidden">
      <div className="hero-orb pointer-events-none absolute -top-40 left-1/2 h-[600px] w-[900px] rounded-full bg-[radial-gradient(closest-side,rgba(115,87,255,.28),transparent)]" />
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 pb-12 pt-8 lg:grid-cols-[1fr_1.05fr] lg:pb-20 lg:pt-16">
        <div className="reveal is-visible">
          <div className="chip border-accent/40 text-[11px] uppercase tracking-[0.18em] text-ink-2">{hero.eyebrow}</div>
          <h1 className="stagger mt-5 text-[40px] font-bold leading-[1.04] tracking-tight sm:text-[48px] md:text-[64px] xl:text-[76px]">
            <span className="block">{hero.lines[0]}</span><span className="block">Build <span className="text-gradient">your channel.</span></span><span className="block">Reach <span className="text-gradient">monetization.</span></span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-ink-2 md:text-xl">{hero.sub}</p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link href="/signup" className="btn-primary flex items-center justify-center gap-2 text-base">{hero.primary} <ArrowRight size={18} /></Link>
            {demo
              ? <button onClick={() => setShow(true)} className="btn-ghost flex items-center justify-center gap-2 text-base"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg"><Play size={12} /></span> {hero.secondary}</button>
              : <a href={hero.demoUrl} className="btn-ghost flex items-center justify-center gap-2 text-base"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-ink text-bg"><Play size={12} /></span> See how it works</a>}
          </div>
          <div className="mt-8 grid grid-cols-2 gap-3 text-sm text-ink-2 sm:grid-cols-4">
            {hero.benefits.map((b, i) => { const I = ICONS[i]; return <div key={b} className="flex items-center gap-2"><span className="rounded-lg border border-line p-1.5 text-ink"><I size={15} /></span>{b}</div>; })}
          </div>
        </div>
        <div className="reveal is-visible [perspective:1400px]" style={{ transitionDelay: "200ms" }}><Tilt max={5} glare={false} className="rounded-2xl"><HeroVisual poster={previewImage} /></Tilt></div>
      </div>
      {show && demo && <VideoModal url={demo.url} title={demo.title} onClose={() => setShow(false)} />}
    </section>
  );
}

/** The product panel from the design, rebuilt in HTML so it is crisp on every screen and always matches the live UI. */
export function StudioMock({ previewImage, compact = false }: { previewImage: string; compact?: boolean }) {
  const stages: [string, "done" | "live" | "todo"][] = [["Writing script", "done"], ["Planning 37 scenes", "done"], ["Generating visuals", "done"], ["Creating voiceover", "done"], ["Adding music & captions", "live"], ["Rendering final video", "todo"]];
  const nav = ["Create video", "My videos", "Ideas", "Content plan", "Growth", "Monetization", "Templates", "Academy"];
  return (
    <div className="relative">
      <div className="absolute -inset-6 rounded-[32px] bg-[radial-gradient(60%_60%_at_50%_40%,rgba(115,87,255,.35),transparent)] blur-2xl" />
      <div className="relative w-full overflow-hidden rounded-2xl border border-line-2 bg-panel shadow-md">
        <div className="flex items-center justify-between border-b border-line px-4 py-2 text-xs text-ink-3"><Logo compact /><span className="hidden sm:inline">Good morning, Jatin</span></div>
        <div className={`grid grid-cols-1 ${compact ? "sm:grid-cols-[96px_1fr]" : "sm:grid-cols-[112px_1fr]"}`}>
          <div className="hidden space-y-1 border-r border-line p-2 text-[11px] text-ink-3 sm:block">{nav.map((n, i) => <div key={n} className={`truncate rounded px-2 py-1 ${i === 0 ? "bg-accent/20 text-ink" : ""}`}>{n}</div>)}</div>
          <div className="p-3">
            <div className="text-xs font-semibold">What do you want to create?</div>
            <div className="mt-1.5 rounded-lg border border-line bg-panel-2 px-2.5 py-2 text-[11px] leading-snug text-ink-2">Create a 7-minute faceless documentary about how the internet changed the world.</div>
            <div className="mt-2 flex flex-wrap gap-1 text-[10px]">{["Documentary", "7 min", "16:9 YouTube", "Hindi"].map((c) => <span key={c} className="chip">{c}</span>)}</div>
            <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_130px]">
              <div className="space-y-1 text-[11px]">{stages.map(([s, st]) => <div key={s} className="flex items-center justify-between rounded bg-panel-2 px-2 py-1"><span className="text-ink-2">{s}</span>{st === "done" ? <Check size={11} className="text-success" /> : st === "live" ? <span className="h-2.5 w-2.5 animate-pulse rounded-full border-2 border-accent" /> : <span className="h-2.5 w-2.5 rounded-full border border-line-2" />}</div>)}</div>
              <div className="overflow-hidden rounded-lg border border-line">
                <div className="relative aspect-video bg-cover bg-center" style={{ backgroundImage: `url(${previewImage})` }}><span className="absolute inset-0 flex items-center justify-center"><span className="flex h-7 w-7 items-center justify-center rounded-full bg-[#ff0000] text-white"><Play size={12} /></span></span></div>
                <div className="grid grid-cols-3 gap-0.5 p-0.5">{[0, 1, 2].map((i) => <div key={i} className="aspect-video rounded-sm bg-panel-3" />)}</div>
              </div>
            </div>
            <div className="mt-2 rounded-lg bg-accent py-1.5 text-center text-[11px] font-semibold text-white">Generate video →</div>
          </div>
        </div>
      </div>
      {!compact && <div className="absolute -bottom-3 right-6 hidden rotate-[-6deg] text-sm text-ink-2 md:block" style={{ fontFamily: "cursive" }}>From idea to a full video in minutes ↗</div>}
    </div>
  );
}
