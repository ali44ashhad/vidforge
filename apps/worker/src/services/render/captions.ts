import type { Timeline } from "../../pipeline/timeline";
import { stripUnrenderable, captionFontFor } from "../../lib/text";

interface Cue { start: number; end: number; text: string }

const MAX_CHARS = 42;
const MAX_DUR = 3.5;

/** Builds caption cues from real word timestamps (falls back to even spacing when a scene has none). */
export function buildCues(tl: Timeline): Cue[] {
  const cues: Cue[] = [];
  for (const sc of tl.scenes) {
    let words = sc.words;
    if (!words.length) {
      // fallback: spread the narration evenly across the voice duration
      const ws = sc.shots.map((s) => s.titleText).join(" ").split(/\s+/).filter(Boolean); // rough; real text lives in voice
      words = ws.map((w, i) => ({ word: w, start: (i / ws.length) * sc.voiceDuration, end: ((i + 1) / ws.length) * sc.voiceDuration }));
    }
    let buf: typeof words = [];
    const flush = () => {
      if (!buf.length) return;
      const text = stripUnrenderable(buf.map((w) => w.word).join(" "));
      if (text) cues.push({ start: sc.start + buf[0].start, end: sc.start + buf[buf.length - 1].end + 0.15, text });
      buf = [];
    };
    for (const w of words) {
      const len = buf.reduce((a, b) => a + b.word.length + 1, 0) + w.word.length;
      const dur = buf.length ? w.end - buf[0].start : 0;
      if (buf.length && (len > MAX_CHARS || dur > MAX_DUR || /[.!?]$/.test(buf[buf.length - 1].word))) flush();
      buf.push(w);
    }
    flush();
  }
  // no overlaps
  for (let i = 1; i < cues.length; i++) if (cues[i].start < cues[i - 1].end) cues[i - 1].end = cues[i].start - 0.02;
  return cues;
}

function ts(sec: number): string {
  const ms = Math.max(0, Math.round(sec * 1000));
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), r = ms % 1000;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")},${String(r).padStart(3, "0")}`;
}

export function toSrt(cues: Cue[]): string {
  return cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n") + "\n";
}

/** libass force_style per caption style (PlayResY defaults to 288 for SRT, so sizes are small numbers). */
export function captionStyle(style: string, sampleText = "", extraMarginV = 0): string {
  const base = `FontName=${captionFontFor(sampleText)},PrimaryColour=&H00FFFFFF,OutlineColour=&H90000000,BackColour=&H80000000,BorderStyle=1,Alignment=2,MarginV=${28 + extraMarginV}`;
  switch (style) {
    case "Bold": return `${base},FontSize=24,Bold=1,Outline=2.5,Shadow=0`;
    case "Word Highlight": return `${base},FontSize=24,Bold=1,Outline=2.5,Shadow=0,PrimaryColour=&H0000E5FF`;
    case "Minimal": return `${base},FontSize=17,Outline=1,Shadow=0`;
    case "Podcast": return `${base},FontSize=22,Bold=1,BorderStyle=3,Outline=6,Shadow=0`;
    case "Documentary": return `${base},FontSize=19,Outline=1.5,Shadow=1`;
    case "Corporate": return `${base},FontSize=19,BorderStyle=3,Outline=8,Shadow=0,BackColour=&H99101216`;
    default: return `${base},FontSize=20,Outline=1.8,Shadow=0.5`; // YouTube Clean
  }
}
