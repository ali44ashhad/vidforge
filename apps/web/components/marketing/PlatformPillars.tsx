"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Clapperboard, Upload, BarChart3, Coins, ArrowRight } from "lucide-react";
import { pillars } from "@/lib/marketing";
import Section from "./Section";
import { StudioMock } from "./Hero";

const ICONS = [Clapperboard, Upload, BarChart3, Coins];

export default function PlatformPillars({ image }: { image: string }) {
  const [i, setI] = useState(0);
  const p = pillars[i];
  return (
    <Section id="system" title="Making a video is only step one." sub="Y2ube helps you build the system around the channel." className="bg-panel/40" depth tone="blue">
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4" role="tablist">
        {pillars.map((x, k) => { const I = ICONS[k]; const on = k === i; return (
          <button key={x.id} role="tab" aria-selected={on} onClick={() => setI(k)} className={`flex min-h-[64px] items-center justify-center gap-2 rounded-2xl border text-base font-semibold transition ${on ? "border-accent bg-accent/15 shadow-[0_0_0_1px_rgba(115,87,255,.4)]" : "border-line bg-panel hover:border-line-2"}`}>
            <I size={20} className={on ? "text-accent" : "text-ink-2"} /> {x.title}{!x.live && <span className="ml-1 rounded-full bg-panel-2 px-1.5 text-[10px] font-normal text-ink-3">soon</span>}
          </button>); })}
      </div>
      <div className="mt-4 grid items-center gap-6 overflow-hidden rounded-3xl border border-line bg-panel p-5 md:grid-cols-[1fr_1.4fr] md:p-8">
        <div>
          <h3 className="display text-2xl font-bold">{p.headline}</h3>
          <ul className="mt-4 space-y-2 text-ink-2">{p.items.map((t) => <li key={t} className="flex items-center gap-2"><Check size={16} className={p.live ? "text-success" : "text-ink-3"} /> {t}</li>)}</ul>
          {p.live ? <Link href="/signup" className="btn-primary mt-6 inline-flex items-center gap-2">{p.cta} <ArrowRight size={16} /></Link> : <span className="chip mt-6">On the roadmap</span>}
        </div>
        <div className="min-w-0"><StudioMock previewImage={image} compact /></div>
      </div>
    </Section>
  );
}
