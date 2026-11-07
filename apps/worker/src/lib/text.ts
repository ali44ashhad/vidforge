import fs from "node:fs";

/** Removes emoji, pictographs, variation selectors and control chars — nothing ffmpeg can draw. */
export function stripUnrenderable(text: string): string {
  return text
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}\u{1F1E6}-\u{1F1FF}]/gu, "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export const hasDevanagari = (t: string) => /[\u0900-\u097F]/.test(t);
export const hasGurmukhi = (t: string) => /[\u0A00-\u0A7F]/.test(t);
export const hasArabic = (t: string) => /[\u0600-\u06FF]/.test(t);
export const hasCJK = (t: string) => /[\u3040-\u30FF\u4E00-\u9FFF\uAC00-\uD7AF]/.test(t);

const first = (paths: string[]) => paths.find((p) => p && fs.existsSync(p)) ?? null;

/**
 * Picks a font FILE for drawtext (overlays, title cards, thumbnails) that can render the text.
 * Env overrides: THUMBNAIL_FONT (bold display font), OVERLAY_FONT, FONT_DEVANAGARI, FONT_GURMUKHI, FONT_ARABIC, FONT_CJK.
 */
export function fontFileFor(text: string, purpose: "display" | "overlay" = "display"): string | null {
  if (hasDevanagari(text)) return first([process.env.FONT_DEVANAGARI || "", "/var/www/vidforge/fonts/Mukta-ExtraBold.ttf", "/var/www/vidforge/fonts/Mukta-Bold.ttf",
    "/System/Library/Fonts/Supplemental/DevanagariMT.ttc", "/System/Library/Fonts/Supplemental/Devanagari Sangam MN.ttc",
    "/System/Library/Fonts/Supplemental/KohinoorDevanagari.ttc", "/System/Library/Fonts/Supplemental/Kohinoor Devanagari.ttc",
    "/Library/Fonts/NotoSansDevanagari-Bold.ttf", "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Bold.ttf", "/usr/share/fonts/truetype/noto/NotoSansDevanagari-Regular.ttf",
    "/usr/share/fonts/truetype/lohit-devanagari/Lohit-Devanagari.ttf"]);
  if (hasGurmukhi(text)) return first([process.env.FONT_GURMUKHI || "", "/var/www/vidforge/fonts/MuktaMahee-ExtraBold.ttf", "/var/www/vidforge/fonts/MuktaMahee-Bold.ttf", "/System/Library/Fonts/Supplemental/Gurmukhi.ttf", "/System/Library/Fonts/Supplemental/GurmukhiMN.ttc", "/usr/share/fonts/truetype/noto/NotoSansGurmukhi-Bold.ttf"]);
  if (hasArabic(text)) return first([process.env.FONT_ARABIC || "", "/System/Library/Fonts/Supplemental/GeezaPro.ttc", "/usr/share/fonts/truetype/noto/NotoNaskhArabic-Bold.ttf"]);
  if (hasCJK(text)) return first([process.env.FONT_CJK || "", "/System/Library/Fonts/Hiragino Sans GB.ttc", "/usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc"]);
  const env = purpose === "display" ? process.env.THUMBNAIL_FONT : process.env.OVERLAY_FONT || process.env.THUMBNAIL_FONT;
  return first([env || "", "/System/Library/Fonts/Supplemental/Arial Black.ttf", "/System/Library/Fonts/Supplemental/Impact.ttf", "/Library/Fonts/Arial Black.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf", "/System/Library/Fonts/Helvetica.ttc"]);
}

/** Font FAMILY NAME for libass captions (force_style FontName). */
export function captionFontFor(text: string): string {
  if (hasDevanagari(text)) return process.env.CAPTION_FONT_DEVANAGARI || (process.platform === "darwin" ? "Devanagari MT" : "Mukta");
  if (hasGurmukhi(text)) return process.env.CAPTION_FONT_GURMUKHI || (process.platform === "darwin" ? "Gurmukhi MN" : "Mukta Mahee");
  if (hasArabic(text)) return process.env.CAPTION_FONT_ARABIC || (process.platform === "darwin" ? "Geeza Pro" : "Noto Naskh Arabic");
  if (hasCJK(text)) return process.env.CAPTION_FONT_CJK || (process.platform === "darwin" ? "Hiragino Sans" : "Noto Sans CJK SC");
  return process.env.CAPTION_FONT || (process.platform === "darwin" ? "Helvetica Neue" : "DejaVu Sans");
}
