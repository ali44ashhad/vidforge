/**
 * Publish kit: SEO titles, description with chapter timestamps, tags, hashtags,
 * and generated thumbnails with bold text — everything needed to upload immediately.
 */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { prisma, type Prisma } from "@vidforge/db";
import { askJson } from "./deepseek";
import { generateAiImage } from "./imageProvider";
import { downloadFile } from "../lib/media";
import { runFfmpeg, filterPath } from "../lib/ffmpeg";
import { projectDir, publicUrl } from "../lib/storage";
import { stripUnrenderable, fontFileFor } from "../lib/text";
import { findStyle } from "@vidforge/shared";

const SeoSchema = z.object({
  titles: z.array(z.string().min(5).max(100)).min(3).max(5),
  description: z.string().min(50),
  tags: z.array(z.string().min(2).max(40)).min(8).max(30),
  hashtags: z.array(z.string().min(2)).min(3).max(8),
  thumbnailTexts: z.array(z.string().min(2).max(34)).min(4).max(8),
  thumbnailHighlightWords: z.array(z.string()).default([]),
  thumbnailPrompt: z.string().min(20),
  thumbnailPromptAlt: z.string().default(""),
  pinnedComment: z.string().default(""),
});
export type SeoKit = z.infer<typeof SeoSchema> & {
  chapters: { time: string; title: string }[];
  backgrounds: { url: string; path: string }[];
  thumbnails: { url: string; path: string; text: string; highlight?: string; bg?: number }[];
  generatedAt: string;
};

function ts(sec: number): string {
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60), h = Math.floor(m / 60);
  return h ? `${h}:${String(m % 60).padStart(2, "0")}:${String(s).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

function wrap2(text: string, maxChars: number): string {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > maxChars && cur) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 3).join("\n");
}

/** Generates the kit for a project and stores it in project.seo. Safe to call repeatedly. */
export async function buildPublishKit(projectId: string, log: (m: string) => void = () => {}): Promise<SeoKit> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, include: { chapters: { orderBy: { order: "asc" } } } });
  const isShort = p.aspectRatio === "R9_16" || p.videoType === "Short";
  const chapters = p.chapters.filter((c) => c.startTime != null).map((c) => ({ time: ts(c.startTime!), title: c.title }));
  if (chapters.length && chapters[0].time !== "0:00") chapters[0].time = "0:00";
  const durationMin = Math.round((p.actualDuration ?? p.targetDuration) / 60);

  const system = `You are a YouTube growth strategist and SEO copywriter. You write metadata that ranks in YouTube search and suggested videos and maximises click-through, without clickbait that the video doesn't deliver. Respond with JSON only.`;
  const user = `Language: ${p.language}. Platform: ${isShort ? "YouTube Shorts / Reels" : "YouTube long-form"}. Video type: ${p.videoType}. Length: ${durationMin} min.
Working title: ${p.title}
Script (for context):
"""
${(p.script ?? p.prompt).slice(0, 6000)}
"""
${chapters.length ? `Chapters with timestamps (already computed, keep them in order): ${chapters.map((c) => `${c.time} ${c.title}`).join(" | ")}` : ""}

Return this JSON:
{
  "titles": [3-5 title options, each under 65 characters, primary keyword in the first 40 characters, curiosity or benefit, no ALL CAPS, no emoji spam],
  "description": "First 2 lines = hook + primary keyword (these show before 'Show more'). Then 2-3 short paragraphs on what the video covers with natural keywords. ${chapters.length ? "Then a 'Chapters' section listing the timestamps exactly as given (00:00 style first line must be 0:00)." : ""} Then a call to action${p.cta ? ` (${p.cta})` : ""}. End with 3-5 hashtags. Plain text with line breaks, no markdown.",
  "tags": [15-25 tags, mix of broad and specific, 1-4 words each, the most important first, total under 480 characters],
  "hashtags": [3-6 hashtags without spaces, most relevant first${isShort ? ", include #Shorts" : ""}],
  "thumbnailTexts": [6 thumbnail text options, 2-4 words each, in the video language, no emojis, each using a DIFFERENT high-CTR pattern: (1) number + outcome e.g. "3 SETTINGS KILL BATTERY", (2) warning e.g. "NEVER DO THIS", (3) contrast "X vs Y", (4) curiosity gap e.g. "THE HIDDEN REASON", (5) first person e.g. "I TRIED IT", (6) bold claim/question e.g. "IS IT A LIE?" — punchy, honest to the content, ALL CAPS where the script allows],
  "thumbnailHighlightWords": [for each option, the single word to colour yellow — the emotional or numeric word],
  "thumbnailPrompt": "background image prompt for a high-CTR YouTube thumbnail: ONE clear subject close to the camera with an expressive face or a dramatic object, strong directional lighting, very high contrast and saturated colours, clean uncluttered background, the subject placed on the RIGHT half so the left half is free for text, no words in the image, matches the video's visual style",
  "thumbnailPromptAlt": "a second, different background concept (wider shot or before/after split), same rules",
  "pinnedComment": "a one-line comment to pin that asks viewers a question"
}`;
  const kit = await askJson(SeoSchema, system, user, 4000);
  log(`SEO copy ready: ${kit.titles.length} titles, ${kit.tags.length} tags`);

  // thumbnails: 2 backgrounds × first text option, plus a variant with the second text
  const dir = projectDir(projectId, "output", "thumbnails");
  const thumbs: SeoKit["thumbnails"] = [];
  const aspect = isShort ? "9:16" : "16:9";
  const W = isShort ? 1080 : 1280, H = isShort ? 1920 : 720;
  const preset = findStyle(p.imageStyle);
  const styleText = preset ? preset.prompt : (p.imageStyle || "cinematic photo");
  const prompts = [kit.thumbnailPrompt, kit.thumbnailPromptAlt || `${kit.thumbnailPrompt}. Different composition: wider shot, dramatic sky.`];
  const refs = ((p.referenceImages as { url: string; path: string; kind: string }[] | null) ?? []).filter((r) => r.kind !== "style").map((r) => (/^https?:\/\//.test(r.url) && !/localhost/.test(r.url) ? r.url : r.path));
  const backgrounds: SeoKit["backgrounds"] = [];
  for (let i = 0; i < 2; i++) {
    try {
      const img = await generateAiImage(`${prompts[i]}. ${styleText}. Ultra sharp, high contrast, saturated, thumbnail composition, no text, no watermark.`, aspect, refs, p.imageStyle);
      const bg = path.join(dir, `bg-${i + 1}.jpg`);
      await downloadFile(img.url, bg);
      backgrounds.push({ url: publicUrl(bg), path: bg });
    } catch (e) { log(`thumbnail background ${i + 1} failed: ${(e as Error).message}`); }
  }
  // first drafts: option 1 on background 1, option 2 on background 2 — the user can re-render any combination
  for (let i = 0; i < Math.min(2, backgrounds.length); i++) {
    try {
      const rawText = stripUnrenderable(kit.thumbnailTexts[i] || kit.thumbnailTexts[0]);
      const highlight = stripUnrenderable(kit.thumbnailHighlightWords[i] || "");
      const out = path.join(dir, `thumbnail-${i + 1}.jpg`);
      await renderThumbnail(backgrounds[i].path, out, rawText, highlight, W, H, isShort, dir, i + 1);
      thumbs.push({ url: publicUrl(out), path: out, text: rawText, highlight, bg: i });
    } catch (e) { log(`thumbnail ${i + 1} failed: ${(e as Error).message}`); }
  }
  const result: SeoKit = { ...kit, chapters, backgrounds, thumbnails: thumbs, generatedAt: new Date().toISOString() };
  await prisma.project.update({ where: { id: projectId }, data: { seo: result as unknown as Prisma.InputJsonValue } });
  log(`publish kit stored (${thumbs.length} thumbnails)`);
  return result;
}

/**
 * YouTube-style thumbnail: punchy contrast, dark gradient on the text side, huge bold text with thick
 * outline and drop shadow, the emotional word in yellow, text on the left (subject stays on the right).
 */
function layoutLines(text: string, highlight: string, maxChars: number): { lines: string[]; hiIndex: number } {
  const words = text.split(/\s+/).filter(Boolean);
  const hi = highlight.trim().toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  const norm = (w: string) => w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, "");
  // highlight word at the end (or start) → isolate it on its own line so it can be coloured
  if (hi && words.length > 1 && norm(words[words.length - 1]) === hi) {
    const rest = wrap2(words.slice(0, -1).join(" "), maxChars).split("\n");
    return { lines: [...rest, words[words.length - 1]], hiIndex: rest.length };
  }
  if (hi && words.length > 1 && norm(words[0]) === hi) {
    const rest = wrap2(words.slice(1).join(" "), maxChars).split("\n");
    return { lines: [words[0], ...rest], hiIndex: 0 };
  }
  const lines = wrap2(text, maxChars).split("\n");
  return { lines, hiIndex: lines.findIndex((l) => norm(l) === hi) };
}

async function renderThumbnail(bg: string, out: string, text: string, highlight: string, W: number, H: number, isShort: boolean, dir: string, n: number) {
  const { lines, hiIndex } = layoutLines(text, highlight, isShort ? 10 : 14);
  const longest = Math.max(...lines.map((l) => l.length));
  // size so the longest line stays within ~55% of the width (bold fonts ≈ 0.62em per char)
  const size = Math.min(Math.round(isShort ? W / 7 : W / 9), Math.round((W * 0.55) / (longest * 0.62)));
  const lineH = Math.round(size * 1.12);
  const x = Math.round(W * 0.045);
  const startY = isShort ? Math.round(H * 0.58) : Math.round(H / 2 - (lines.length * lineH) / 2 + H * 0.08);
  const ff = fontFileFor(text, "display");
  const font = ff ? `:fontfile='${filterPath(ff)}'` : "";
  const parts = [
    `scale=${W}:${H}:force_original_aspect_ratio=increase,crop=${W}:${H}`,
    "eq=contrast=1.18:saturation=1.3:brightness=0.02",
    // left-side darkening so white text pops, plus a bottom fade
    `drawbox=x=0:y=0:w=${Math.round(W * 0.62)}:h=ih:color=black@0.30:t=fill`,
    `drawbox=x=0:y=${Math.round(H * 0.7)}:w=iw:h=${Math.round(H * 0.3)}:color=black@0.25:t=fill`,
  ];
  lines.forEach((line, i) => {
    const tf = path.join(dir, `t${n}-${i}.txt`);
    fs.writeFileSync(tf, line);
    const color = i === hiIndex ? "#FFD400" : "white";
    parts.push(`drawtext=textfile='${filterPath(tf)}'${font}:fontsize=${size}:fontcolor=${color}:borderw=${Math.round(size / 8)}:bordercolor=black:shadowcolor=black@0.7:shadowx=${Math.round(size / 14)}:shadowy=${Math.round(size / 14)}:x=${x}:y=${startY + i * lineH}`);
  });
  await runFfmpeg(["-i", bg, "-vf", parts.join(","), "-q:v", "2", out]);
}

/** Re-render thumbnails from the stored backgrounds with user-chosen text (no AI cost). */
export async function renderThumbnailsFromChoices(projectId: string, items: { bg: number; text: string; highlight?: string }[]): Promise<SeoKit> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const kit = p.seo as SeoKit | null;
  if (!kit?.backgrounds?.length) throw new Error("No thumbnail backgrounds yet — generate the publish kit first");
  const isShort = p.aspectRatio === "R9_16" || p.videoType === "Short";
  const W = isShort ? 1080 : 1280, H = isShort ? 1920 : 720;
  const dir = projectDir(projectId, "output", "thumbnails");
  const thumbs: SeoKit["thumbnails"] = [];
  for (let i = 0; i < Math.min(6, items.length); i++) {
    const it = items[i];
    const bg = kit.backgrounds[Math.min(Math.max(0, it.bg | 0), kit.backgrounds.length - 1)];
    const text = stripUnrenderable(it.text).slice(0, 40);
    if (!text) continue;
    const out = path.join(dir, `thumbnail-${i + 1}.jpg`);
    await renderThumbnail(bg.path, out, text, stripUnrenderable(it.highlight || ""), W, H, isShort, dir, i + 1);
    thumbs.push({ url: `${publicUrl(out)}?v=${Date.now()}`, path: out, text, highlight: it.highlight, bg: it.bg });
  }
  const result: SeoKit = { ...kit, thumbnails: thumbs, generatedAt: new Date().toISOString() };
  await prisma.project.update({ where: { id: projectId }, data: { seo: result as unknown as Prisma.InputJsonValue } });
  return result;
}
