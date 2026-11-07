/**
 * Ad banners: a dark band at the top with a headline (highlight word in accent colour) and a band at the
 * bottom with the CTA. Rendered with drawbox + drawtext; widths are estimated from character counts so the
 * highlight word can sit inline before the rest of the headline.
 */
import fs from "node:fs";
import path from "node:path";
import { filterPath } from "../../lib/ffmpeg";
import { stripUnrenderable, fontFileFor } from "../../lib/text";

const est = (text: string, size: number) => Math.round(text.length * size * 0.58); // bold sans average advance

export function bannerFilters(b: { top?: string; topHighlight?: string; bottom?: string; color?: string } | null, W: number, H: number, dir: string): string[] {
  if (!b) return [];
  const out: string[] = [];
  const color = (b.color || "#FF7A00").replace("#", "0x");
  const top = stripUnrenderable(b.top || "");
  const bottom = stripUnrenderable(b.bottom || "");
  const hi = stripUnrenderable(b.topHighlight || "");
  fs.mkdirSync(dir, { recursive: true });
  const fontFor = (t: string) => { const f = fontFileFor(t, "display"); return f ? `:fontfile='${filterPath(f)}'` : ""; };

  if (top) {
    const bandH = Math.round(H * (W > H ? 0.12 : 0.075));
    let size = Math.round(bandH * 0.62);
    // shrink until it fits 92% of the width
    while (est(top, size) > W * 0.92 && size > 18) size -= 2;
    out.push(`drawbox=x=0:y=0:w=iw:h=${bandH}:color=black@0.92:t=fill`);
    const y = `${Math.round(bandH / 2)}-text_h/2`;
    const idx = hi ? top.indexOf(hi) : -1;
    if (idx >= 0) {
      const before = top.slice(0, idx).trimEnd(), after = top.slice(idx + hi.length).trimStart();
      const gap = Math.round(size * 0.55);
      const total = est(before, size) + (before ? gap : 0) + est(hi, size) + (after ? gap : 0) + est(after, size);
      let x = Math.round((W - total) / 2);
      const seg = (t: string, c: string) => {
        const tf = path.join(dir, `banner-${Math.random().toString(36).slice(2, 7)}.txt`); fs.writeFileSync(tf, t);
        out.push(`drawtext=textfile='${filterPath(tf)}'${fontFor(t)}:fontsize=${size}:fontcolor=${c}:x=${x}:y=${y}`);
        x += est(t, size) + gap;
      };
      if (before) seg(before, "white");
      seg(hi, color);
      if (after) seg(after, "white");
    } else {
      const tf = path.join(dir, "banner-top.txt"); fs.writeFileSync(tf, top);
      out.push(`drawtext=textfile='${filterPath(tf)}'${fontFor(top)}:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${y}`);
    }
  }
  if (bottom) {
    const bandH = Math.round(H * (W > H ? 0.11 : 0.07));
    let size = Math.round(bandH * 0.55);
    while (est(bottom, size) > W * 0.92 && size > 18) size -= 2;
    const tf = path.join(dir, "banner-bottom.txt"); fs.writeFileSync(tf, bottom);
    out.push(`drawbox=x=0:y=${H - bandH}:w=iw:h=${bandH}:color=black@0.85:t=fill`,
      `drawtext=textfile='${filterPath(tf)}'${fontFor(bottom)}:fontsize=${size}:fontcolor=white:x=(w-text_w)/2:y=${H - bandH / 2}-text_h/2`);
  }
  return out;
}
