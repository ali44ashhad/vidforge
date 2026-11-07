"use client";

import { useEffect, useRef } from "react";

/**
 * A horizontal rail that glides continuously (desktop and mobile), pauses while the visitor hovers, touches or drags it,
 * and resumes a few seconds later. The track is duplicated so the loop is seamless. Reduced-motion: static, scrollable.
 */
export default function AutoRail({ children, speed = 28, className = "", gap = 12 }: { children: React.ReactNode; speed?: number; className?: string; gap?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    let paused = false, resumeAt = 0, raf = 0, last = performance.now();
    const half = () => el.scrollWidth / 2;
    const tick = (now: number) => {
      const dt = Math.min(64, now - last); last = now;
      if (!paused && now > resumeAt) { el.scrollLeft += (speed * dt) / 1000; if (el.scrollLeft >= half()) el.scrollLeft -= half(); }
      raf = requestAnimationFrame(tick);
    };
    const pause = () => { paused = true; };
    const resume = () => { paused = false; resumeAt = performance.now() + 2500; };
    el.addEventListener("pointerenter", pause); el.addEventListener("pointerleave", resume);
    el.addEventListener("touchstart", pause, { passive: true }); el.addEventListener("touchend", resume, { passive: true });
    el.addEventListener("focusin", pause); el.addEventListener("focusout", resume);
    el.addEventListener("scroll", () => { if (el.scrollLeft < 0) el.scrollLeft += half(); }, { passive: true });
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); el.removeEventListener("pointerenter", pause); el.removeEventListener("pointerleave", resume); el.removeEventListener("touchstart", pause); el.removeEventListener("touchend", resume); el.removeEventListener("focusin", pause); el.removeEventListener("focusout", resume); };
  }, [speed]);
  return (
    <div ref={ref} className={`rail-auto ${className}`} style={{ gap }}>
      {children}
      <div aria-hidden className="contents">{children}</div>
    </div>
  );
}
