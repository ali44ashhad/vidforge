"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { faqs } from "@/lib/marketing";
import Section from "./Section";

export default function FAQ() {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <Section title="Questions, answered." sub="Everything you need to know before your first video.">
      <div className="mx-auto max-w-3xl divide-y divide-line rounded-2xl border border-line bg-panel">
        {faqs.map(([q, a], i) => (
          <div key={q}>
            <button className="flex w-full items-center justify-between gap-4 px-5 py-4 text-left font-medium" onClick={() => setOpen(open === i ? null : i)} aria-expanded={open === i}>{q}<ChevronDown size={18} className={`shrink-0 text-ink-3 transition ${open === i ? "rotate-180" : ""}`} /></button>
            {open === i && <p className="px-5 pb-5 text-sm leading-relaxed text-ink-2">{a}</p>}
          </div>
        ))}
      </div>
    </Section>
  );
}
