"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { templateCards, templateFilters } from "@/lib/marketing";
import Section from "./Section";
import AutoRail from "./AutoRail";
import Tilt from "./Tilt";

export default function TemplatesShowcase({ total, images }: { total: number; images: Record<string, string> }) {
  const [f, setF] = useState("All");
  const items = templateCards.filter((t) => f === "All" || t.tag === f);
  return (
    <Section id="templates" depth title="Popular video templates." sub={`Choose from ${total} templates or start with a custom idea.`} action={<Link href="/signup" className="btn-ghost flex items-center gap-2 text-sm">View all templates <ArrowRight size={14} /></Link>}>
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{templateFilters.map((x) => <button key={x} onClick={() => setF(x)} className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-sm ${f === x ? "bg-accent text-white" : "border border-line text-ink-2 hover:border-line-2"}`}>{x}</button>)}</div>
      <AutoRail className="mt-5" speed={30} key={f}>
        {items.map((t) => (
          <Tilt key={t.id} className="w-40 rounded-2xl sm:w-44">
          <Link href={`/signup?type=${encodeURIComponent(t.id)}`} className="group block overflow-hidden rounded-2xl border border-line bg-panel">
            <div className="relative aspect-[3/4] overflow-hidden"><Image src={images[t.key]} width={480} height={640} alt={t.name} className="h-full w-full object-cover transition group-hover:scale-105" /><span className="absolute inset-x-2 bottom-2 rounded-lg bg-accent/90 py-1 text-center text-[11px] font-semibold text-white opacity-0 transition group-hover:opacity-100">Use template →</span></div>
            <div className="p-2.5"><div className="text-sm font-semibold">{t.name}</div><div className="text-[11px] leading-snug text-ink-3">{t.sub}</div></div>
          </Link>
          </Tilt>
        ))}
      </AutoRail>
    </Section>
  );
}
