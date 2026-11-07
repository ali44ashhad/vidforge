"use client";

import { useEffect, useRef, useState } from "react";
import { Volume2, VolumeX, Check, TrendingUp, Sparkles } from "lucide-react";
import Logo from "@/components/Logo";

const LINES = ["Build your channel.", "Publish every week.", "Reach monetization.", "Grow on autopilot."];
const PROOF = [["Script → video", "in minutes"], ["10 languages", "Hindi & Punjabi ready"], ["1-click publish", "to YouTube"]];

/** Conversion panel for auth pages: showreel behind, rotating bold line, growth card, optional narrated demo. */
export default function AuthShowcase({ showreel, demo, poster, variant = "side" }: { showreel: string | null; demo: string | null; poster: string; variant?: "side" | "top" }) {
  const [i, setI] = useState(0);
  const [sound, setSound] = useState(false);
  const [t, setT] = useState(0);
  const v = useRef<HTMLVideoElement>(null);
  useEffect(() => { const id = setInterval(() => setI((x) => (x + 1) % LINES.length), 2600); return () => clearInterval(id); }, []);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(1); return; }
    let raf = 0; const s = performance.now(); const tick = (n: number) => { const p = Math.min(1, (n - s) / 2400); setT(1 - Math.pow(1 - p, 3)); if (p < 1) raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  const src = sound && demo ? demo : showreel;
  useEffect(() => { const el = v.current; if (!el) return; el.muted = !sound; el.load(); el.play().catch(() => {}); }, [src, sound]);
  const subs = Math.round(1200 + 11100 * t), hours = Math.round(400 + 4800 * t);
  const pts = [8, 12, 11, 16, 22, 21, 30, 38, 36, 48, 62, 78, 95]; const W = 320, H = 90, step = W / (pts.length - 1); const shown = Math.max(2, Math.ceil(pts.length * t));
  const path = pts.slice(0, shown).map((p, k) => `${k === 0 ? "M" : "L"}${(k * step).toFixed(1)},${(H - (p / 100) * H).toFixed(1)}`).join(" ");

  if (variant === "top") return (
    <div className="relative mb-6 overflow-hidden rounded-2xl border border-line bg-[#08090d] text-white lg:hidden" style={{ colorScheme: "dark" }}>
      <div className="relative aspect-[16/10]">
        {src ? <video ref={v} src={src} poster={poster} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-70" /> : <div className="absolute inset-0 bg-cover bg-center opacity-60" style={{ backgroundImage: `url(${poster})` }} />}
        <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/40 to-transparent" />
        <div className="absolute inset-x-4 bottom-3">
          <div className="display text-2xl font-bold leading-tight">Create videos.<span className="relative block h-[1.2em] overflow-hidden">{LINES.map((l, k) => <span key={l} className="absolute left-0 top-0 text-gradient transition-all duration-700" style={{ opacity: k === i ? 1 : 0, transform: k === i ? "translateY(0)" : "translateY(120%)" }}>{l}</span>)}</span></div>
        </div>
        {demo && <button type="button" onClick={() => setSound(!sound)} aria-label={sound ? "Mute" : "Play demo with sound"} className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-black/60 px-2.5 py-1.5 text-xs backdrop-blur">{sound ? <VolumeX size={13} /> : <Volume2 size={13} />} {sound ? "Mute" : "Hear demo"}</button>}
      </div>
      <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10 text-center text-xs">
        <div className="py-2.5"><div className="display text-base font-bold tabular-nums">{subs.toLocaleString()}</div><div className="text-white/60">subscribers</div></div>
        <div className="py-2.5"><div className="display text-base font-bold tabular-nums">{hours.toLocaleString()}</div><div className="text-white/60">watch hours</div></div>
        <div className="py-2.5"><div className="flex items-center justify-center gap-1 text-[#31D682]"><Check size={12} /> eligible</div><div className="text-white/60">monetization</div></div>
      </div>
    </div>
  );

  return (
    <aside className="relative hidden overflow-hidden bg-[#08090d] text-white lg:block" style={{ colorScheme: "dark" }}>
      {src ? <video ref={v} src={src} poster={poster} autoPlay muted loop playsInline className="absolute inset-0 h-full w-full object-cover opacity-60" /> : <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url(${poster})` }} />}
      <div className="absolute inset-0 bg-gradient-to-t from-[#08090d] via-[#08090d]/70 to-[#08090d]/30" />
      <div className="absolute inset-0 bg-[radial-gradient(60%_50%_at_30%_30%,rgba(115,87,255,.35),transparent)]" />
      <div className="relative flex h-full flex-col justify-between p-10">
        <div className="flex items-center justify-between"><Logo /><span className="chip border-white/15 bg-white/5 text-white/80"><Sparkles size={12} className="text-[#FFB648]" /> Made entirely with Y2ube</span></div>
        <div>
          <h2 className="display text-5xl font-bold leading-[1.05]">
            Create videos.<br />
            <span className="relative block h-[1.15em] overflow-hidden">{LINES.map((l, k) => <span key={l} className="absolute left-0 top-0 text-gradient transition-all duration-700" style={{ opacity: k === i ? 1 : 0, transform: k === i ? "translateY(0)" : "translateY(120%)" }}>{l}</span>)}</span>
          </h2>
          <p className="mt-4 max-w-md text-lg text-white/70">One prompt becomes a complete, publish-ready video — script, visuals, voice, music, captions, thumbnails and SEO.</p>
          <div className="mt-6 flex flex-wrap gap-2">{PROOF.map(([a, b]) => <span key={a} className="rounded-full border border-white/15 bg-white/5 px-3 py-1.5 text-xs"><span className="font-semibold">{a}</span> <span className="text-white/60">{b}</span></span>)}</div>
          <div className="mt-8 max-w-md rounded-2xl border border-white/15 bg-black/40 p-4 backdrop-blur">
            <div className="flex items-center justify-between text-xs text-white/70"><span>Channel growth · illustrative</span><span className="flex items-center gap-1 rounded-full bg-[#31D682]/15 px-2 py-0.5 text-[#31D682]"><Check size={11} /> Monetization eligible</span></div>
            <div className="mt-3 grid grid-cols-2 gap-3">
              <div><div className="text-[11px] text-white/60">Subscribers</div><div className="display text-2xl font-bold tabular-nums">{subs.toLocaleString()}</div><div className="flex items-center gap-1 text-[11px] text-[#31D682]"><TrendingUp size={11} /> +318%</div></div>
              <div><div className="text-[11px] text-white/60">Watch hours</div><div className="display text-2xl font-bold tabular-nums">{hours.toLocaleString()}</div><div className="flex items-center gap-1 text-[11px] text-[#31D682]"><TrendingUp size={11} /> +290%</div></div>
            </div>
            <svg viewBox={`0 0 ${W} ${H + 4}`} className="mt-3 h-20 w-full" aria-hidden><defs><linearGradient id="afill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7357FF" stopOpacity=".5" /><stop offset="1" stopColor="#7357FF" stopOpacity="0" /></linearGradient></defs><path d={`${path} L${(shown - 1) * step},${H} L0,${H} Z`} fill="url(#afill)" /><path d={path} fill="none" stroke="#A96AFF" strokeWidth="2.5" strokeLinecap="round" /></svg>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs text-white/50">
          <span>© {new Date().getFullYear()} Y2ube</span>
          {demo && <button type="button" onClick={() => setSound(!sound)} className="flex items-center gap-2 rounded-full border border-white/20 bg-white/5 px-3 py-1.5 text-white transition hover:bg-white/10">{sound ? <VolumeX size={14} /> : <Volume2 size={14} />} {sound ? "Back to showreel" : "Hear the 90-sec demo"}</button>}
        </div>
      </div>
    </aside>
  );
}
