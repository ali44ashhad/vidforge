"use client";

import { useEffect, useState } from "react";
import { Check, Youtube, TrendingUp, Eye, Users, Clock, Sparkles } from "lucide-react";

/** Illustrative channel-growth composition (not a real account). Animates on mount; respects reduced motion. */
export default function HeroVisual({ poster }: { poster: string }) {
  const [t, setT] = useState(0); // 0..1 progress of the intro animation
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setT(1); return; }
    let raf = 0; const start = performance.now();
    const tick = (now: number) => { const p = Math.min(1, (now - start) / 2600); setT(1 - Math.pow(1 - p, 3)); if (p < 1) raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick); return () => cancelAnimationFrame(raf);
  }, []);
  const subs = Math.round(1240 + 11020 * t), views = Math.round(48_000 + 1_212_000 * t), hours = Math.round(410 + 4_790 * t);
  const pts = [8, 12, 11, 16, 22, 21, 30, 38, 36, 48, 62, 78, 95];
  const W = 520, H = 160, step = W / (pts.length - 1);
  const shown = Math.max(2, Math.ceil(pts.length * t));
  const path = pts.slice(0, shown).map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(H - (v / 100) * H).toFixed(1)}`).join(" ");
  const last = { x: (shown - 1) * step, y: H - (pts[shown - 1] / 100) * H };
  const subsPct = Math.min(100, Math.round((subs / 1000) * 100)), hoursPct = Math.min(100, Math.round((hours / 4000) * 100));
  const eligible = subsPct >= 100 && hoursPct >= 100;
  const fmt = (n: number) => (n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e3 ? `${(n / 1e3).toFixed(n >= 1e5 ? 0 : 1)}K` : String(n));

  return (
    <div className="relative mx-auto w-full max-w-[600px] lg:my-24">
      <div className="pointer-events-none absolute inset-0 rounded-[40px] bg-[radial-gradient(60%_60%_at_60%_40%,rgba(115,87,255,.35),transparent)] blur-2xl md:-inset-8" />
      {/* main analytics card */}
      <div className="relative rounded-2xl border border-line-2 bg-panel/95 p-4 shadow-md backdrop-blur sm:p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm"><span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#ff0000] text-white"><Youtube size={15} /></span><span className="font-semibold">Channel growth</span><span className="text-ink-3">· last 90 days</span></div>
          <span className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition ${eligible ? "bg-success/15 text-success" : "bg-panel-2 text-ink-3"}`}><Check size={12} /> {eligible ? "Monetization eligible" : "Building toward monetization"}</span>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-3">
          {[[Users, "Subscribers", fmt(subs), "+318%"], [Eye, "Views", fmt(views), "+412%"], [Clock, "Watch hours", fmt(hours), "+290%"]].map(([I, l, v, d]) => { const Icon = I as typeof Users; return (
            <div key={String(l)} className="rounded-xl border border-line bg-panel-2 p-3"><div className="flex items-center gap-1.5 text-[11px] text-ink-3"><Icon size={12} /> {String(l)}</div><div className="mt-1 display text-lg font-bold tabular-nums sm:text-2xl">{String(v)}</div><div className="flex items-center gap-1 text-[11px] text-success"><TrendingUp size={11} /> {String(d)}</div></div>); })}
        </div>
        <svg viewBox={`0 0 ${W} ${H + 8}`} className="mt-4 h-28 w-full sm:h-40" aria-hidden>
          <defs><linearGradient id="fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7357FF" stopOpacity=".45" /><stop offset="1" stopColor="#7357FF" stopOpacity="0" /></linearGradient><linearGradient id="line" x1="0" x2="1"><stop offset="0" stopColor="#A96AFF" /><stop offset="1" stopColor="#4776FF" /></linearGradient></defs>
          {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="rgba(255,255,255,.06)" />)}
          <path d={`${path} L${last.x},${H} L0,${H} Z`} fill="url(#fill)" />
          <path d={path} fill="none" stroke="url(#line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx={last.x} cy={last.y} r="5" fill="#fff" /><circle cx={last.x} cy={last.y} r="10" fill="#7357FF" opacity=".35" />
        </svg>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {[["1,000 subscribers", subsPct, subs], ["4,000 watch hours", hoursPct, hours]].map(([l, p, cur]) => (
            <div key={String(l)}><div className="flex justify-between text-[11px] text-ink-3"><span>{String(l)}</span><span className={Number(p) >= 100 ? "text-success" : ""}>{Number(p) >= 100 ? "✓ reached" : `${Number(cur).toLocaleString()} · ${p}%`}</span></div><div className="mt-1 h-1.5 overflow-hidden rounded-full bg-panel-3"><div className="h-full rounded-full bg-gradient-to-r from-accent to-[#4776FF] transition-all" style={{ width: `${p}%` }} /></div></div>
          ))}
        </div>
      </div>
      {/* floating cards */}
      <div className="absolute -top-[92px] left-0 hidden w-64 animate-[float_6s_ease-in-out_infinite] rounded-xl border border-line-2 bg-panel p-3 shadow-md lg:block">
        <div className="flex gap-2"><div className="h-12 w-20 shrink-0 rounded-md bg-cover bg-center" style={{ backgroundImage: `url(${poster})` }} /><div className="min-w-0"><div className="truncate text-xs font-medium">Why the Sahara was green</div><div className="mt-0.5 flex items-center gap-1 whitespace-nowrap text-[11px] text-success"><Check size={11} /> Published · 6:00 PM</div><div className="text-[11px] text-ink-3">+2,341 views in 24h</div></div></div>
      </div>
      <div className="absolute -bottom-[88px] right-0 hidden w-64 animate-[float_7s_ease-in-out_infinite_1s] rounded-xl border border-line-2 bg-panel p-3 shadow-md lg:block">
        <div className="flex items-center gap-2 text-xs font-medium"><Sparkles size={14} className="text-energy" /> Next video suggestion</div>
        <p className="mt-1 text-[11px] text-ink-3">Explainers over 7 min keep your viewers longest. Try "The future of AI in everyday life".</p>
      </div>
      <p className="mt-3 text-center text-[10px] text-ink-3 md:hidden">Illustrative channel data</p>
    </div>
  );
}
