/**
 * Subscribe / bell call-to-action overlay: a red "SUBSCRIBE" pill with the channel line under it, sliding up
 * from the bottom edge, holding, and sliding away. Shown twice — mid-video and over the closing seconds — to
 * match the narrator's spoken CTA. Drawn with drawtext (its x/y accept time expressions), so no assets and no
 * extra encode pass: it rides in the same filter chain as the look, logo and captions.
 *
 * CTA_OVERLAY=off disables it; CTA_CHANNEL sets the channel name (default "Story Factory Hindi").
 */
import fs from "node:fs";
import path from "node:path";
import { filterPath } from "../../lib/ffmpeg";
import { stripUnrenderable, fontFileFor } from "../../lib/text";

export interface CtaWindow { start: number; end: number; kind: "mid" | "end" }

/** When the CTA shows. Mid needs a long enough video to be worth interrupting; end always, if there's room. */
export function ctaWindows(total: number): CtaWindow[] {
  if (process.env.CTA_OVERLAY === "off" || total < 45) return [];
  const w: CtaWindow[] = [];
  // CTA_MID=off → end-only (the DocSaga pattern: one ask, at the end). Otherwise a mid-roll on long videos too.
  if (total >= 150 && process.env.CTA_MID !== "off") { const s = Math.round(total * 0.5); w.push({ start: s, end: s + 6.5, kind: "mid" }); }
  w.push({ start: Math.max(0, total - 9), end: total - 1.2, kind: "end" });
  return w;
}

export function ctaChannel(): string { return process.env.CTA_CHANNEL || "Story Factory Hindi"; }

/** drawtext filters for every window; append to the video chain with a comma. */
export function ctaFilters(total: number, W: number, H: number, language: string, dir: string): string[] {
  const windows = ctaWindows(total);
  if (!windows.length) return [];
  fs.mkdirSync(dir, { recursive: true });
  const hindi = /hindi/i.test(language);
  const line1 = "SUBSCRIBE";
  const line2 = stripUnrenderable(`${ctaChannel()}  ·  ${hindi ? "bell icon दबाइए" : "and hit the bell"}`);
  const f1 = path.join(dir, "cta-1.txt"), f2 = path.join(dir, "cta-2.txt");
  fs.writeFileSync(f1, line1); fs.writeFileSync(f2, line2);
  const font1 = fontFileFor(line1, "display"), font2 = fontFileFor(line2, "overlay");
  const ff1 = font1 ? `:fontfile='${filterPath(font1)}'` : "", ff2 = font2 ? `:fontfile='${filterPath(font2)}'` : "";
  const size1 = Math.round(W / 22), size2 = Math.round(W / 40);
  const pad1 = Math.round(size1 * 0.45), pad2 = Math.round(size2 * 0.4);
  const slide = Math.round(H * 0.22);                 // how far it travels in from below
  const restY1 = Math.round(H * 0.74);                // top of the pill when settled
  const restY2 = restY1 + size1 + pad1 * 2 + Math.round(H * 0.012);
  const out: string[] = [];
  for (const w of windows) {
    const A = w.start.toFixed(3), B = w.end.toFixed(3);
    // 0 while settled, rising to 1 in the first/last 0.45 s of the window. Commas are safe inside the
    // single-quoted option values (the standard drawtext idiom, e.g. x='if(gt(t,2),100,0)').
    const rise = `max(0,max(1-(t-${A})/0.45,1-(${B}-t)/0.45))`;
    const en = `enable='between(t,${A},${B})'`;
    out.push(`drawtext=textfile='${filterPath(f1)}'${ff1}:fontsize=${size1}:fontcolor=white:box=1:boxcolor=0xE62117@0.96:boxborderw=${pad1}:x=(w-text_w)/2:y='${restY1}+${slide}*${rise}':${en}`);
    out.push(`drawtext=textfile='${filterPath(f2)}'${ff2}:fontsize=${size2}:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=${pad2}:x=(w-text_w)/2:y='${restY2}+${slide}*${rise}':${en}`);
  }
  return out;
}
