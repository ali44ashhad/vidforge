"use client";

import { useEffect, useRef, useState } from "react";
import { Rocket, Film, Upload, BarChart3, Coins, Check, Youtube } from "lucide-react";
import { roadmap } from "@/lib/marketing";
import Section from "./Section";

const COLORS = ["#7357FF", "#4776FF", "#4FA3FF", "#31D682", "#A96AFF"];
const ICONS = [Rocket, Film, Upload, BarChart3, Coins];
const STEP_MS = 3400;

/** Interactive journey: steps activate in sequence (auto-play, pause on hover; click to jump); the line draws itself. */
export default function JourneyRoadmap({ image }: { image: string }) {
  const [active, setActive] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const railRef = useRef<HTMLDivElement>(null);
  const stepRefs = useRef<(HTMLButtonElement | null)[]>([]);
  // phones/tablets: slide the rail to the active step
  useEffect(() => {
    const rail = railRef.current, el = stepRefs.current[active];
    if (!rail || !el || window.innerWidth >= 1024) return;
    rail.scrollTo({ left: el.offsetLeft - (rail.clientWidth - el.clientWidth) / 2, behavior: "smooth" });
  }, [active]);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0.3 });
    io.observe(el); return () => io.disconnect();
  }, []);
  useEffect(() => {
    if (!playing || !inView) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const t = setInterval(() => setActive((a) => (a + 1) % roadmap.length), STEP_MS);
    return () => clearInterval(t);
  }, [playing, inView]);
  const pct = (active / (roadmap.length - 1)) * 100;

  return (
    <Section id="roadmap" depth title="From zero to channel." sub="A clear path to YouTube success.">
      <div ref={ref} onPointerEnter={() => setPlaying(false)} onPointerLeave={() => setPlaying(true)} onTouchStart={() => setPlaying(false)} onTouchEnd={() => setTimeout(() => setPlaying(true), 4000)} className="relative">
        {/* desktop: horizontal drawing line */}
        <div className="absolute left-[10%] right-[10%] top-6 hidden h-px bg-line lg:block">
          <div className="h-full bg-gradient-to-r from-[#7357FF] via-[#4FA3FF] to-[#31D682] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} />
          <div className="absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-white shadow-[0_0_0_6px_rgba(115,87,255,.25),0_0_18px_#7357FF] transition-all duration-700 ease-out" style={{ left: `${pct}%` }} />
        </div>
        {/* mobile/tablet: horizontal progress line above the rail */}
        <div className="mx-6 mb-4 h-px bg-line lg:hidden"><div className="h-full bg-gradient-to-r from-[#7357FF] via-[#4FA3FF] to-[#31D682] transition-all duration-700 ease-out" style={{ width: `${pct}%` }} /></div>

        <div ref={railRef} className="rail lg:m-0 lg:grid lg:grid-cols-5 lg:gap-6 lg:overflow-visible lg:p-0 lg:pt-4">
          {roadmap.map((s, i) => { const I = ICONS[i]; const on = i === active, done = i < active; return (
            <button key={s.n} ref={(el) => { stepRefs.current[i] = el; }} type="button" onClick={() => { setActive(i); setPlaying(false); }} aria-current={on ? "step" : undefined}
              className={`group relative flex w-[78vw] max-w-[300px] flex-col items-center text-center transition-all duration-500 lg:w-auto lg:max-w-none ${on ? "opacity-100" : "opacity-70 hover:opacity-100"}`}>
              <div className="relative z-10 flex h-12 w-12 shrink-0 items-center justify-center rounded-full border-2 bg-bg text-sm font-bold transition-all duration-500" style={{ borderColor: COLORS[i], color: done ? "#fff" : COLORS[i], background: done ? COLORS[i] : undefined, boxShadow: on ? `0 0 0 8px ${COLORS[i]}33, 0 0 30px ${COLORS[i]}88` : "none", transform: on ? "scale(1.12)" : "scale(1)" }}>
                {done ? <Check size={18} /> : s.n}
              </div>
              <div className="w-full">
                <div className="mt-3 flex items-center justify-center gap-2 display text-xl font-bold"><I size={18} style={{ color: COLORS[i] }} />{s.title}</div>
                <div className="text-sm text-ink-3">{s.sub}</div>
                <div className={`mx-auto mt-4 w-48 overflow-hidden rounded-2xl border bg-panel text-left transition-all duration-500 lg:w-44 ${on ? "border-line-2 shadow-[0_18px_50px_rgba(0,0,0,.45)] scale-[1.04]" : "border-line"}`}>
                  <Panel i={i} image={image} on={on} />
                </div>
                {!s.live && <div className="mt-2 text-[10px] uppercase tracking-wide text-ink-3">Coming soon</div>}
              </div>
            </button>); })}
        </div>
        <div className="mt-6 flex justify-center gap-1.5">{roadmap.map((_, i) => <span key={i} className="h-1.5 rounded-full transition-all duration-500" style={{ width: i === active ? 22 : 6, background: i === active ? COLORS[i] : "rgba(255,255,255,.15)" }} />)}</div>
      </div>
    </Section>
  );
}

/** Step panels come alive while active. */
function Panel({ i, image, on }: { i: number; image: string; on: boolean }) {
  if (i === 0) return (
    <div className="space-y-1.5 p-3 text-[11px]">
      {["Niche & audience", "Channel name", "Logo & banner", "First 10 ideas"].map((t, k) => (
        <div key={t} className="flex items-center justify-between rounded-md border border-line bg-panel-2 px-2 py-1.5 text-ink-2"><span>{t}</span><Check size={11} className="text-success transition-all duration-500" style={{ opacity: on ? 1 : 0, transform: on ? "scale(1)" : "scale(.5)", transitionDelay: on ? `${300 + k * 350}ms` : "0ms" }} /></div>
      ))}
    </div>
  );
  if (i === 1) return (
    <div className="p-3">
      <div className="aspect-[3/4] overflow-hidden rounded-lg bg-cover bg-center transition-transform duration-[3000ms]" style={{ backgroundImage: `url(${image})`, transform: on ? "scale(1.08)" : "scale(1)" }} />
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-panel-3"><div className="h-full rounded-full bg-accent" style={{ width: on ? "100%" : "0%", transition: on ? "width 3s linear" : "none" }} /></div>
      <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-3"><span className={`h-1.5 w-1.5 rounded-full ${on ? "animate-pulse bg-accent" : "bg-ink-3"}`} /> {on ? "Rendering…" : "Ready to render"}</div>
    </div>
  );
  if (i === 2) return (
    <div className="flex flex-col items-center gap-3 p-3">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#ff0000] text-white transition-transform duration-500" style={{ transform: on ? "scale(1.08) rotate(-3deg)" : "none" }}><Youtube size={30} /></div>
      <div className="w-full rounded-lg py-1.5 text-center text-[11px] font-semibold text-white transition-colors duration-700" style={{ background: on ? "#31D682" : "#7357FF", transitionDelay: on ? "1500ms" : "0ms" }}>{on ? "Published ✓" : "Publish"}</div>
      <div className="w-full rounded-md border border-line py-1 text-center text-[10px] text-ink-3">Schedule · 6:00 PM</div>
    </div>
  );
  if (i === 3) return (
    <div className="p-3">
      <div className="text-[11px] text-success">{on ? "+125% views" : "Views"}</div>
      <div className="mt-2 flex h-24 items-end gap-1">{[30, 45, 38, 60, 55, 78, 70, 95].map((h, k) => <div key={k} className="flex-1 rounded-sm bg-gradient-to-t from-accent/40 to-accent" style={{ height: on ? `${h}%` : "8%", transition: `height .6s cubic-bezier(.2,.7,.2,1) ${k * 90}ms` }} />)}</div>
    </div>
  );
  const p = on ? 75 : 0;
  return (
    <div className="flex flex-col items-center p-3">
      <div className="relative h-20 w-20 rounded-full transition-[background] duration-[1500ms]" style={{ background: `conic-gradient(#31D682 0 ${p}%, rgba(255,255,255,.08) ${p}% 100%)` }}><div className="absolute inset-2 flex items-center justify-center rounded-full bg-panel text-sm font-bold tabular-nums">{p}%</div></div>
      <div className="mt-3 w-full space-y-1 text-[10px] text-ink-3">{["1,000 subscribers", "4,000 watch hours", "Policy readiness"].map((t, k) => <div key={t} className="flex items-center gap-1"><Check size={10} className={on && k < 2 ? "text-success" : "text-ink-3"} style={{ transition: "color .4s", transitionDelay: `${600 + k * 300}ms` }} /> {t}</div>)}</div>
    </div>
  );
}
