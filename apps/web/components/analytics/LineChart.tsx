"use client";

import { useState } from "react";

/** Lightweight SVG area chart with hover tooltip and optional previous-period comparison. */
export default function LineChart({ points, prev, label, format = (n: number) => n.toLocaleString() }: { points: { x: string; y: number }[]; prev?: number[]; label: string; format?: (n: number) => string }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 800, H = 240, P = 28;
  const max = Math.max(1, ...points.map((p) => p.y), ...(prev ?? []));
  const X = (i: number) => P + (i * (W - P * 2)) / Math.max(1, points.length - 1), Y = (v: number) => H - P - (v / max) * (H - P * 2);
  const path = points.map((p, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(p.y).toFixed(1)}`).join(" ");
  const ppath = prev?.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
  const ticks = [0, 0.25, 0.5, 0.75, 1];
  if (!points.length) return <div className="flex h-56 items-center justify-center text-[14px] text-ink-3">No data for this period.</div>;
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-56 w-full md:h-64" onMouseLeave={() => setHover(null)}>
        <defs><linearGradient id="lc" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#7A5CFF" stopOpacity=".45" /><stop offset="1" stopColor="#7A5CFF" stopOpacity="0" /></linearGradient></defs>
        {ticks.map((t) => <g key={t}><line x1={P} x2={W - P} y1={Y(max * t)} y2={Y(max * t)} stroke="rgba(255,255,255,.06)" /><text x={P - 6} y={Y(max * t) + 4} textAnchor="end" fontSize="10" fill="#697386">{format(Math.round(max * t))}</text></g>)}
        {ppath && <path d={ppath} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="2" strokeDasharray="4 4" />}
        <path d={`${path} L${X(points.length - 1)},${H - P} L${X(0)},${H - P} Z`} fill="url(#lc)" />
        <path d={path} fill="none" stroke="#7A5CFF" strokeWidth="2.5" strokeLinejoin="round" />
        {points.map((p, i) => <rect key={i} x={X(i) - (W - P * 2) / points.length / 2} y={0} width={(W - P * 2) / points.length} height={H} fill="transparent" onMouseEnter={() => setHover(i)} />)}
        {hover != null && <g><line x1={X(hover)} x2={X(hover)} y1={P} y2={H - P} stroke="rgba(255,255,255,.2)" /><circle cx={X(hover)} cy={Y(points[hover].y)} r="5" fill="#fff" /></g>}
        {points.filter((_, i) => i % Math.ceil(points.length / 6) === 0 || i === points.length - 1).map((p) => { const i = points.indexOf(p); return <text key={p.x} x={X(i)} y={H - 8} textAnchor="middle" fontSize="10" fill="#697386">{new Date(p.x).toLocaleDateString(undefined, { month: "short", day: "numeric" })}</text>; })}
      </svg>
      {hover != null && <div className="pointer-events-none absolute left-1/2 top-2 -translate-x-1/2 rounded-lg border border-line bg-panel px-3 py-1.5 text-xs shadow-md"><span className="text-ink-3">{new Date(points[hover].x).toLocaleDateString()}</span> · <span className="font-semibold">{format(points[hover].y)}</span> {label}{prev && <span className="text-ink-3"> · prev {format(prev[hover] ?? 0)}</span>}</div>}
    </div>
  );
}
