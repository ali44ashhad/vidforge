/**
 * Voice provider facade. Everything else in the app imports from here.
 *   VOICE_PROVIDER=elevenlabs  → ElevenLabs directly (word timestamps for captions)
 */
import fs from "node:fs";
import { env } from "../../env";
import { y2fetch, y2ubeRemote } from "../y2ube";
import * as eleven from "./elevenlabs";
import { kieSpeakToFile, listKieVoices, resolveKieVoice } from "./kie";

export type { VoiceInfo, Alignment } from "./elevenlabs";
export { normalizeForSpeech } from "./normalize";
export { alignmentToWords } from "./elevenlabs";

export const providerName = () => (env.VOICE_PROVIDER === "kie" ? "kie" : "elevenlabs");

export async function listVoices() {
  if (y2ubeRemote()) {
    const r = await y2fetch<{ voices: eleven.VoiceInfo[] }>("/api/v1/providers/voices", { timeoutMs: 60_000 });
    return r.voices ?? [];
  }
  return providerName() === "kie" ? listKieVoices() : eleven.listVoices();
}

/** Prefer voices whose labels mention the language or an Indian accent for Indic languages. */
export function languageVoiceScore(language: string, labels: Record<string, string> | null | undefined, name = ""): number {
  const l = Object.values(labels ?? {}).join(" ").toLowerCase() + " " + name.toLowerCase();
  const k = language.toLowerCase();
  let s = 0;
  if (l.includes(k)) s += 6;
  if (/hindi|punjabi|tamil|telugu|marathi|bengali|urdu/.test(k) && /indian|india|hindi|desi/.test(l)) s += 4;
  if (k.startsWith("english") && /american|british|australian|neutral/.test(l)) s += 1;
  return s;
}

export async function resolveVoiceId(style: string, projectVoiceId?: string | null, language?: string, prismaClient?: { voice: { findMany: () => Promise<{ id: string; name: string; labels: unknown }[]> } }): Promise<string> {
  if (providerName() === "kie") return resolveKieVoice(style, projectVoiceId);
  if (!projectVoiceId && language && prismaClient) {
    const pool = await prismaClient.voice.findMany();
    const best = pool.map((v) => ({ id: v.id, s: languageVoiceScore(language, v.labels as Record<string, string>, v.name) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 4) return best.id;
  }
  return eleven.resolveVoiceId(style, projectVoiceId);
}

export interface SynthArgs { text: string; voiceId: string; style: string; speed: number; dest: string; previousText?: string; nextText?: string; language?: string }

/** Returns word timings when the provider supplies them, otherwise null (caller estimates). */
export async function synthesizeToFile(args: SynthArgs): Promise<{ alignment: eleven.Alignment | null }> {
  if (y2ubeRemote()) {
    const r = await y2fetch<{ audioBase64?: string; alignment: eleven.Alignment | null }>("/api/v1/providers/voice", {
      method: "POST", timeoutMs: 360_000,
      body: { text: args.text, voiceId: args.voiceId, style: args.style, speed: args.speed, language: args.language, previousText: args.previousText, nextText: args.nextText },
    });
    if (!r.audioBase64) throw new Error("y2ube voice response had no audio");
    fs.writeFileSync(args.dest, Buffer.from(r.audioBase64, "base64"));
    return { alignment: r.alignment ?? null };
  }
  if (providerName() === "kie") {
    await kieSpeakToFile(args.text, args.voiceId, args.dest, args.style);
    return { alignment: null };
  }
  return eleven.synthesizeToFile(args);
}

/**
 * Fallback caption timing: spreads words across the measured audio length, weighted by
 * character count, with extra time after punctuation. Good enough to stay within ~0.3 s.
 */
export function estimateWords(text: string, duration: number): { word: string; start: number; end: number }[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const w = words.map((x) => x.replace(/[^\p{L}\p{N}]/gu, "").length + 1 + (/[.!?]$/.test(x) ? 4 : /[,;:]$/.test(x) ? 2 : 0));
  const total = w.reduce((a, b) => a + b, 0);
  const usable = Math.max(0.5, duration - 0.15); // small lead-in
  let t = 0.05;
  return words.map((word, i) => {
    const d = (w[i] / total) * usable;
    const out = { word, start: t, end: t + d * 0.9 };
    t += d;
    return out;
  });
}

export async function ping(): Promise<string> {
  if (y2ubeRemote()) {
    const r = await y2fetch<{ detail?: string }>("/api/v1/providers/ping", { timeoutMs: 30_000 });
    return r.detail ?? "y2ube";
  }
  const v = await eleven.listVoices();
  return `ElevenLabs: ${v.length} voices (first: ${v[0]?.name} ${v[0]?.voice_id})`;
}

/** Copies the provider's voice list into the Voice table so the web app can show a picker with previews. */
export async function syncVoicesToDb(prisma: { voice: { upsert: (args: unknown) => Promise<unknown> } }): Promise<number> {
  const voices = await listVoices();
  for (const v of voices) {
    const vv = v as eleven.VoiceInfo & { preview_url?: string };
    await prisma.voice.upsert({
      where: { id: v.voice_id },
      create: { id: v.voice_id, name: v.name, category: v.category ?? null, labels: v.labels ?? {}, previewUrl: vv.preview_url ?? null },
      update: { name: v.name, category: v.category ?? null, labels: v.labels ?? {}, previewUrl: vv.preview_url ?? null },
    });
  }
  return voices.length;
}
