"use client";

import { useEffect, useState } from "react";
import { Search, X } from "lucide-react";
import { VIDEO_TEMPLATES, TEMPLATE_GROUPS } from "@vidforge/shared";

const ICON: Record<string, string> = {
  "YouTube Video": "youtube-video", "YouTube Documentary": "documentary", "History Documentary": "history-documentary", "Explainer": "explainer", "Whiteboard Explainer": "whiteboard-explainer",
  "Educational": "educational", "Top 10": "top-10", "Comparison": "comparison", "Finance": "finance", "Tech Review": "tech-review", "Health & Fitness": "health-fitness", "Travel": "travel",
  "Facts": "facts", "Faceless Video": "faceless", "Kids Story": "kids-story", "Horror Story": "horror", "Reddit Story": "reddit-story", "Motivational": "motivational", "Short": "short-reel",
  "Advertisement": "ad-promo", "Spokesperson Ad": "spokesperson-ad-with-ai-presenter", "Product Video": "product", "Corporate": "corporate", "Real Estate": "real-estate", "News": "news",
  "Case Study": "case-study", "Cinematic Showreel": "cinematic-showreel", "Ambient": "ambient-no-narration",
};
const SYNONYMS: Record<string, string> = { "property ad": "Real Estate", "reel": "Short", "instagram": "Short", "listicle": "Top 10", "presenter": "Spokesperson Ad", "avatar": "Spokesperson Ad", "bhajan": "Ambient", "sleep": "Ambient", "story": "Kids Story" };

/** Type icon rendered via CSS mask so it takes the current text colour. */
function Icon({ id, className = "" }: { id: string; className?: string }) {
  const url = `/type-icons/${ICON[id] ?? "youtube-video"}.svg`;
  return <span aria-hidden className={`inline-block h-6 w-6 bg-accent ${className}`} style={{ WebkitMaskImage: `url(${url})`, maskImage: `url(${url})`, WebkitMaskSize: "contain", maskSize: "contain", WebkitMaskRepeat: "no-repeat", maskRepeat: "no-repeat" }} />;
}

/** Video format chooser: compact selected card in the form; a full-screen modal with search, groups and rich cards. */
export default function TypePicker({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [templates, setTemplates] = useState(VIDEO_TEMPLATES);
  useEffect(() => { fetch("/api/catalog").then((r) => r.json()).then((d) => { if (Array.isArray(d.templates) && d.templates.length) setTemplates(d.templates); }).catch(() => {}); }, []);
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  useEffect(() => { if (!open) return; const k = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false); window.addEventListener("keydown", k); document.body.style.overflow = "hidden"; return () => { window.removeEventListener("keydown", k); document.body.style.overflow = ""; }; }, [open]);
  const current = templates.find((t) => t.id === value);
  const k = q.trim().toLowerCase();
  const match = (t: (typeof templates)[number]) => !k || t.name.toLowerCase().includes(k) || t.description.toLowerCase().includes(k) || t.id.toLowerCase().includes(k) || Object.entries(SYNONYMS).some(([syn, id]) => id === t.id && syn.includes(k));
  const minutes = (t: (typeof templates)[number]) => { const s = t.defaults.durationSeconds ?? (t.pacing === "energetic" ? 60 : 300); return s < 60 ? `${s}s` : `${Math.round(s / 60)} min`; };
  const groups = TEMPLATE_GROUPS.map((g) => ({ g, items: templates.filter((t) => t.group === g && match(t)) })).filter((x) => x.items.length);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="flex min-h-[44px] w-full items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2 text-left transition hover:border-accent">
        <Icon id={value} className="shrink-0" />
        <span className="min-w-0 flex-1"><span className="block truncate text-[14px] font-medium">{current?.name ?? value}</span><span className="block truncate text-[12px] text-ink-3">{current?.description}</span></span>
        <span className="shrink-0 text-[12px] text-accent">Change</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 p-0 md:items-center md:p-6" onClick={() => setOpen(false)}>
          <div className="flex h-[92vh] w-full max-w-5xl flex-col rounded-t-2xl border border-line bg-panel shadow-md md:h-[85vh] md:rounded-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 border-b border-line px-5 py-3">
              <div className="flex-1"><div className="text-[16px] font-semibold">Choose a video type</div><div className="text-[12px] text-ink-3">Each type applies its playbook: pacing, visuals, look, music and captions.</div></div>
              <div className="relative w-64 max-w-[45vw]"><Search size={16} className="absolute left-3 top-3 text-ink-3" /><input autoFocus className="field h-10 pl-9 text-[14px]" placeholder="Search formats…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
              <button type="button" className="rounded-lg p-2 text-ink-3 hover:text-ink" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-4">
              {groups.length === 0 && <p className="py-10 text-center text-[14px] text-ink-3">No format matches “{q}”.</p>}
              {groups.map(({ g, items }) => (
                <section key={g} className="mb-6">
                  <h3 className="mb-2 text-[12px] font-semibold uppercase tracking-wide text-ink-3">{g}</h3>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {items.map((t) => { const on = t.id === value; return (
                      <button key={t.id} type="button" onClick={() => { onChange(t.id); setOpen(false); setQ(""); }} className={`flex gap-3 rounded-xl border p-3.5 text-left transition ${on ? "border-accent bg-accent/10 shadow-[0_0_0_1px_rgba(108,76,255,.5)]" : "border-line bg-panel-2 hover:border-line-2"}`}>
                        <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-lg ${on ? "bg-accent/25" : "bg-panel"}`}><Icon id={t.id} /></span>
                        <span className="min-w-0"><span className="block text-[14px] font-semibold">{t.name}</span><span className="mt-0.5 line-clamp-2 block text-[12px] leading-snug text-ink-2">{t.description}</span><span className="mt-1.5 flex flex-wrap gap-1 text-[11px] text-ink-3"><span className="chip">{minutes(t)}</span><span className="chip">{t.defaults.visualSource.replace(/_/g, " ")}</span><span className="chip">{t.defaults.style.replace(/_/g, " ")}</span>{t.defaults.aspectRatio === "R9_16" && <span className="chip">9:16</span>}</span></span>
                      </button>); })}
                  </div>
                </section>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
