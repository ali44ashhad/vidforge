"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Reveal-on-scroll primitive. Children fade/slide in when they enter the viewport (once).
 * `delay` in ms staggers siblings; `as` picks the wrapper element. Honors prefers-reduced-motion via CSS.
 */
export default function Reveal({ children, delay = 0, className = "", as: Tag = "div", y = 24 }: { children: React.ReactNode; delay?: number; className?: string; as?: "div" | "section" | "li" | "article"; y?: number }) {
  const ref = useRef<HTMLElement | null>(null);
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = ref.current; if (!el) return;
    if (!("IntersectionObserver" in window)) { setOn(true); return; }
    const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { setOn(true); io.disconnect(); } }, { rootMargin: "0px 0px -10% 0px", threshold: 0.1 });
    io.observe(el); return () => io.disconnect();
  }, []);
  const T = Tag as unknown as "div";
  return <T ref={ref as React.RefObject<HTMLDivElement>} className={`reveal ${on ? "is-visible" : ""} ${className}`} style={{ transitionDelay: `${delay}ms`, ["--reveal-y" as string]: `${y}px` }}>{children}</T>;
}
