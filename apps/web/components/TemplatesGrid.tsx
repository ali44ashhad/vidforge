"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

type T = { id: string; name: string; group: string; description: string; duration: number; aspect: string; style: string };
const KEY: Record<string, string> = { "YouTube Documentary": "documentary", "History Documentary": "documentary", Explainer: "explainer", "Whiteboard Explainer": "explainer", Educational: "explainer", "Top 10": "top10", Comparison: "top10", Finance: "finance", "Tech Review": "tech", "Health & Fitness": "motivation", Travel: "travel", Facts: "top10", "Faceless Video": "documentary", "Kids Story": "kids", "Horror Story": "horror", "Reddit Story": "kids", Motivational: "motivation", Short: "shorts", Advertisement: "ads", "Spokesperson Ad": "ads", "Product Video": "ads", Corporate: "ads", "Real Estate": "realestate", News: "documentary", "Case Study": "ads", "Cinematic Showreel": "travel", Ambient: "travel" };
const FILTERS = ["All", "Long-form", "Short-form", "Story & entertainment", "Business", "Music-led"];

export default function TemplatesGrid({ templates, images }: { templates: T[]; images: Record<string, string> }) {
  const [f, setF] = useState("All");
  const items = templates.filter((t) => f === "All" || t.group === f);
  return (
    <div>
      <div className="mb-6"><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Video Templates</h1><p className="mt-1 text-[15px] text-ink-2">Every template carries a playbook — hook style, pacing, visuals, music and captions tuned for that format.</p></div>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{FILTERS.map((x) => <button key={x} onClick={() => setF(x)} className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 text-[13px] ${f === x ? "bg-accent text-white" : "border border-line text-ink-2"}`}>{x}</button>)}</div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {items.map((t) => (
          <div key={t.id} className="group overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-line-2">
            <div className="relative aspect-video overflow-hidden bg-panel-2"><img src={images[KEY[t.id] ?? "documentary"]} alt="" className="h-full w-full object-cover transition group-hover:scale-105" /><span className="absolute left-2 top-2 pill pill-draft">{t.group}</span></div>
            <div className="p-4"><div className="text-[15px] font-semibold">{t.name}</div><p className="mt-1 line-clamp-2 text-[13px] text-ink-2">{t.description}</p><div className="mt-2 text-[12px] text-ink-3">~{Math.round(t.duration / 60) || 1} min · {t.aspect === "R9_16" ? "9:16" : "16:9"} · {t.style.replace(/_/g, " ")}</div>
              <Link href={`/create?type=${encodeURIComponent(t.id)}`} className="btn-gradient mt-3 flex items-center justify-center gap-1 py-2 text-[13px]">Use template <ArrowRight size={13} /></Link></div>
          </div>
        ))}
      </div>
    </div>
  );
}
