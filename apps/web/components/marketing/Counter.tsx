"use client";

import { useEffect, useRef, useState } from "react";

/** Counts from 0 to `to` when scrolled into view. Accepts "12,400", "1.2M", "28", "4.9/5", "1-click" (non-numeric shown as-is). */
export default function Counter({ value, className = "" }: { value: string; className?: string }) {
  const m = /^([\d.,]+)(.*)$/.exec(value);
  const target = m ? Number(m[1].replace(/,/g, "")) : NaN;
  const suffix = m ? m[2] : "";
  const decimals = m && m[1].includes(".") ? m[1].split(".")[1].length : 0;
  const ref = useRef<HTMLSpanElement>(null);
  const [n, setN] = useState(0);
  useEffect(() => {
    if (!Number.isFinite(target) || !ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) { setN(target); return; }
    const io = new IntersectionObserver(([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const start = performance.now(); const dur = 1400;
      const tick = (now: number) => { const p = Math.min(1, (now - start) / dur); setN(target * (1 - Math.pow(1 - p, 3))); if (p < 1) requestAnimationFrame(tick); };
      requestAnimationFrame(tick);
    }, { threshold: 0.5 });
    io.observe(ref.current); return () => io.disconnect();
  }, [target]);
  if (!Number.isFinite(target)) return <span className={className}>{value}</span>;
  return <span ref={ref} className={`tabular-nums ${className}`}>{n.toLocaleString("en-IN", { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}{suffix}</span>;
}
