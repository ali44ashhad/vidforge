"use client";

import { useEffect, useRef } from "react";

/** Moves its content vertically at `speed` × scroll (negative = opposite direction). Purely transform-based. */
export default function Parallax({ children, speed = 0.15, className = "" }: { children: React.ReactNode; speed?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let raf = 0;
    const update = () => { const r = el.getBoundingClientRect(); const mid = r.top + r.height / 2 - window.innerHeight / 2; el.style.transform = `translate3d(0, ${(-mid * speed).toFixed(1)}px, 0)`; raf = 0; };
    const onScroll = () => { if (!raf) raf = requestAnimationFrame(update); };
    update(); window.addEventListener("scroll", onScroll, { passive: true }); window.addEventListener("resize", onScroll);
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); if (raf) cancelAnimationFrame(raf); };
  }, [speed]);
  return <div ref={ref} className={`will-change-transform ${className}`}>{children}</div>;
}
