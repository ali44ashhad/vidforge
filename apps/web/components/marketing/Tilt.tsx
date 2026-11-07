"use client";

import { useRef } from "react";

/**
 * 3D tilt toward the pointer with a moving light sheen (desktop). On touch devices it keeps a gentle resting depth.
 * `max` = degrees. Reduced-motion: no tilt.
 */
export default function Tilt({ children, className = "", max = 8, glare = true, as: Tag = "div" }: { children: React.ReactNode; className?: string; max?: number; glare?: boolean; as?: "div" | "article" }) {
  const ref = useRef<HTMLDivElement>(null);
  const move = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current; if (!el || e.pointerType === "touch") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const r = el.getBoundingClientRect(); const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
    el.style.setProperty("--rx", `${((0.5 - py) * max * 2).toFixed(2)}deg`); el.style.setProperty("--ry", `${((px - 0.5) * max * 2).toFixed(2)}deg`);
    el.style.setProperty("--gx", `${(px * 100).toFixed(1)}%`); el.style.setProperty("--gy", `${(py * 100).toFixed(1)}%`);
  };
  const leave = () => { const el = ref.current; if (!el) return; el.style.setProperty("--rx", "0deg"); el.style.setProperty("--ry", "0deg"); };
  const T = Tag as "div";
  return <T ref={ref} onPointerMove={move} onPointerLeave={leave} className={`tilt ${glare ? "tilt-glare" : ""} ${className}`}>{children}</T>;
}
