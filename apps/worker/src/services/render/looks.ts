/**
 * Builds ffmpeg filters for a finishing look. `k` (0..1.5) scales every effect so the intensity slider works.
 * Returns the main-chain filter string and, optionally, a lavfi light-leak source to screen-blend on top.
 */
export interface LookFilters { chain: string; leak: { source: string; opacity: number } | null }

const f = (n: number) => n.toFixed(3);

import type { LookParams } from "@vidforge/shared";

export function lookFilters(look: string, intensity: number, W: number, H: number, params?: LookParams | null): LookFilters | null {
  const k = Math.max(0, Math.min(1.5, intensity / 100));
  if (!look || look === "none" || k === 0) return null;
  if (look === "auto") return params ? fromParams(params, W, H) : lookFilters("bright_clean", intensity, W, H);

  const eq = (c: number, s: number, g = 0) => `eq=contrast=${f(1 + c * k)}:saturation=${f(1 + s * k)}${g ? `:gamma=${f(1 + g * k)}` : ""}`;
  const curveS = (lo: number, hi: number) => `curves=master='0/0 0.25/${f(0.25 - lo * k)} 0.5/0.5 0.75/${f(0.75 + hi * k)} 1/1'`;
  const fade = (lift: number) => `curves=master='0/${f(lift * k)} 0.5/0.5 1/1'`;
  const cb = (rs: number, bs: number, rh: number, bh: number) => `colorbalance=rs=${f(rs * k)}:bs=${f(bs * k)}:rh=${f(rh * k)}:bh=${f(bh * k)}`;
  const sharpen = (a: number) => `unsharp=5:5:${f(a * k)}`;
  const vignette = (strength: number) => `vignette=angle=${f(Math.PI / (6 - 2.5 * strength * k))}`; // PI/6 mild … PI/3.5 strong
  const grain = (amt: number) => `noise=c0s=${Math.round(amt * k)}:c0f=t+u`; // luma-only grain: same look, ~3x cheaper
  const leak = (color: string, opacity: number, fromRight = true) => ({
    source: `gradients=size=${W}x${H}:c0=${color}:c1=0x000000:x0=${Math.round(W * (fromRight ? 0.88 : 0.12))}:y0=${Math.round(H * 0.12)}:x1=${Math.round(W * (fromRight ? 0.25 : 0.75))}:y1=${Math.round(H * 0.85)}:type=radial:speed=0.02,format=rgba`,
    opacity: Math.min(0.5, opacity * k),
  });

  switch (look) {
    case "bright_clean":
      return { chain: [eq(0.08, 0.22, 0.03), `curves=master='0/0.02 0.5/0.53 1/1'`, sharpen(0.55)].join(","), leak: null };
    case "youtube_pop":
      return { chain: [eq(0.10, 0.18), curveS(0.03, 0.03), sharpen(0.45), vignette(0.3)].join(","), leak: null };
    case "cinematic":
      return { chain: [eq(0.12, 0.08, -0.02), curveS(0.04, 0.04), cb(-0.03, 0.06, 0.05, -0.04), sharpen(0.4), vignette(0.6), grain(7)].join(","), leak: leak("0xffb070", 0.16) };
    case "warm_film":
      return { chain: [eq(0.08, 0.05), curveS(0.02, 0.03), cb(0.06, -0.05, 0.08, -0.06), vignette(0.45), grain(8)].join(","), leak: leak("0xffc27a", 0.22) };
    case "cool_thriller":
      return { chain: [eq(0.16, -0.10), curveS(0.05, 0.02), cb(-0.05, 0.10, -0.02, 0.06), sharpen(0.3), vignette(0.9), grain(9)].join(","), leak: leak("0x7fb4ff", 0.10, false) };
    case "vintage":
      return { chain: [fade(0.08), eq(0.02, -0.20), cb(0.07, -0.08, 0.06, -0.10), vignette(0.7), grain(13)].join(","), leak: leak("0xffd9a0", 0.18) };
    case "vivid":
      return { chain: [eq(0.10, 0.32), curveS(0.03, 0.03), sharpen(0.5)].join(","), leak: null };
    case "noir":
      return { chain: ["hue=s=0", eq(0.22, 0), curveS(0.06, 0.04), vignette(0.8), grain(11)].join(","), leak: null };
    default:
      return null;
  }
}

/** Continuous parameters (each roughly -1..1 or 0..1) chosen by the AI → ffmpeg filters. */
function fromParams(p: LookParams, W: number, H: number): LookFilters {
  const c = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, Number.isFinite(v) ? v : 0));
  const parts: string[] = [];
  parts.push(`eq=contrast=${f(1 + 0.25 * c(p.contrast, -1, 1))}:saturation=${f(1 + 0.45 * c(p.saturation, -1, 1))}:brightness=${f(0.08 * c(p.brightness, -1, 1))}`);
  const w = c(p.warmth, -1, 1);
  if (Math.abs(w) > 0.05) parts.push(`colorbalance=rs=${f(0.08 * w)}:bs=${f(-0.08 * w)}:rh=${f(0.06 * w)}:bh=${f(-0.06 * w)}`);
  if (c(p.sharpen, 0, 1) > 0.05) parts.push(`unsharp=5:5:${f(0.9 * c(p.sharpen, 0, 1))}`);
  if (c(p.vignette, 0, 1) > 0.05) parts.push(`vignette=angle=${f(Math.PI / (6 - 2.5 * c(p.vignette, 0, 1)))}`);
  if (c(p.grain, 0, 1) > 0.05) parts.push(`noise=c0s=${Math.round(14 * c(p.grain, 0, 1))}:c0f=t+u`);
  const leakAmt = c(p.leak, 0, 1);
  return {
    chain: parts.join(","),
    leak: leakAmt > 0.05 ? { source: `gradients=size=${W}x${H}:c0=${w >= 0 ? "0xffb070" : "0x7fb4ff"}:c1=0x000000:x0=${Math.round(W * 0.88)}:y0=${Math.round(H * 0.12)}:x1=${Math.round(W * 0.25)}:y1=${Math.round(H * 0.85)}:type=radial:speed=0.02,format=rgba`, opacity: 0.3 * leakAmt } : null,
  };
}
