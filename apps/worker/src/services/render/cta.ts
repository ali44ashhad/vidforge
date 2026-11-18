/**
 * Subscribe / bell call-to-action overlay: a red "SUBSCRIBE" pill with the channel line under it, sliding up
 * from the bottom edge over the closing seconds only. Drawn with drawtext (its x/y accept time expressions),
 * so no assets and no extra encode pass: it rides in the same filter chain as the look, logo and captions.
 *
 * CTA_OVERLAY=off disables it. The channel line is the name entered when the video was created.
 */
import fs from "node:fs";
import path from "node:path";
import { filterPath } from "../../lib/ffmpeg";
import { stripUnrenderable, fontFileFor } from "../../lib/text";

export interface CtaWindow { start: number; end: number; kind: "mid" | "end" }

/** When the CTA shows: the last few seconds only. */
export function ctaWindows(total: number): CtaWindow[] {
  if (process.env.CTA_OVERLAY === "off" || total < 45) return [];
  return [{ start: Math.max(0, total - 9), end: total - 1.2, kind: "end" }];
}

/** drawtext filters for every window; append to the video chain with a comma. */
export function ctaFilters(total: number, W: number, H: number, language: string, dir: string, channel?: string | null): string[] {
  const windows = ctaWindows(total);
  if (!windows.length) return [];
  fs.mkdirSync(dir, { recursive: true });
  const hindi = /hindi/i.test(language);
  const name = stripUnrenderable((channel ?? "").trim()).slice(0, 80);
  const line0 = "Like & Subscribe";
  const line1 = "SUBSCRIBE";
  const line2 = name ? stripUnrenderable(`${name}  ·  ${hindi ? "bell icon दबाइए" : "and hit the bell"}`) : "";
  const f0 = path.join(dir, "cta-0.txt"), f1 = path.join(dir, "cta-1.txt"), f2 = path.join(dir, "cta-2.txt");
  fs.writeFileSync(f0, line0); fs.writeFileSync(f1, line1); if (line2) fs.writeFileSync(f2, line2);
  const font0 = fontFileFor(line0, "display"), font1 = fontFileFor(line1, "display"), font2 = line2 ? fontFileFor(line2, "overlay") : null;
  const ff0 = font0 ? `:fontfile='${filterPath(font0)}'` : "", ff1 = font1 ? `:fontfile='${filterPath(font1)}'` : "", ff2 = font2 ? `:fontfile='${filterPath(font2)}'` : "";
  const size0 = Math.round(W / 28), size1 = Math.round(W / 22), size2 = Math.round(W / 40);
  const pad1 = Math.round(size1 * 0.45), pad2 = Math.round(size2 * 0.4);
  const slide = Math.round(H * 0.22);
  const restY1 = Math.round(H * 0.70);
  const restY0 = restY1 - size0 - Math.round(H * 0.04);
  const restY2 = restY1 + size1 + pad1 * 2 + Math.round(H * 0.018);
  const out: string[] = [];
  for (const w of windows) {
    const A = w.start.toFixed(3), B = w.end.toFixed(3);
    const rise = `max(0,max(1-(t-${A})/0.45,1-(${B}-t)/0.45))`;
    const en = `enable='between(t,${A},${B})'`;
    out.push(`drawtext=textfile='${filterPath(f0)}'${ff0}:fontsize=${size0}:fontcolor=white:x=(w-text_w)/2:y='${restY0}+${slide}*${rise}':${en}`);
    out.push(`drawtext=textfile='${filterPath(f1)}'${ff1}:fontsize=${size1}:fontcolor=white:box=1:boxcolor=0xE62117@0.96:boxborderw=${pad1}:x=(w-text_w)/2:y='${restY1}+${slide}*${rise}':${en}`);
    if (line2) out.push(`drawtext=textfile='${filterPath(f2)}'${ff2}:fontsize=${size2}:fontcolor=white:box=1:boxcolor=black@0.62:boxborderw=${pad2}:x=(w-text_w)/2:y='${restY2}+${slide}*${rise}':${en}`);
  }
  return out;
}
