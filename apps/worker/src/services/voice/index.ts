/**
 * Voice provider facade. Everything else in the app imports from here.
 *   VOICE_PROVIDER=elevenlabs  → ElevenLabs directly (word timestamps for captions)
 *   VOICE_PROVIDER=abhibots    → AbhiBots reseller (no timestamps → estimated caption timing)
 */
import { env } from "../../env";
import * as eleven from "./elevenlabs";
import * as abhi from "./abhibots";

export type { VoiceInfo, Alignment } from "./elevenlabs";
export { normalizeForSpeech } from "./normalize";
export { alignmentToWords } from "./elevenlabs";

export const providerName = () => (env.VOICE_PROVIDER === "abhibots" ? "abhibots" : "elevenlabs");

export async function listVoices() {
  return providerName() === "abhibots" ? abhi.listVoices() : eleven.listVoices();
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
  if (!projectVoiceId && language && prismaClient) {
    const pool = await prismaClient.voice.findMany();
    const best = pool.map((v) => ({ id: v.id, s: languageVoiceScore(language, v.labels as Record<string, string>, v.name) })).sort((a, b) => b.s - a.s)[0];
    if (best && best.s >= 4) return best.id;
  }
  if (providerName() === "elevenlabs") return eleven.resolveVoiceId(style, projectVoiceId);
  // an explicit choice (user, AI casting, brand kit or template default) always wins: the reseller proxies
  // ElevenLabs, so any voice id that exists on the account works even when it is not in the reseller's own list
  if (projectVoiceId) return projectVoiceId;
  const voices = await abhi.listVoices();
  const ids = new Set(voices.map((v) => v.voice_id));
  if (env.ELEVENLABS_VOICE_ID && ids.has(env.ELEVENLABS_VOICE_ID)) return env.ELEVENLABS_VOICE_ID;
  for (const id of eleven.STYLE_DEFAULTS[style] ?? []) if (ids.has(id)) return id;
  // the reseller list may be empty/partial — premade ElevenLabs IDs still work there
  return projectVoiceId || env.ELEVENLABS_VOICE_ID || eleven.STYLE_DEFAULTS[style]?.[0] || voices[0]?.voice_id || "21m00Tcm4TlvDq8ikWAM";
}

export interface SynthArgs { text: string; voiceId: string; style: string; speed: number; dest: string; previousText?: string; nextText?: string; language?: string }

/** Returns word timings when the provider supplies them, otherwise null (caller estimates). */
export async function synthesizeToFile(args: SynthArgs): Promise<{ alignment: eleven.Alignment | null }> {
  if (providerName() === "elevenlabs") return eleven.synthesizeToFile(args);
  const s = eleven.settingsForStyle(args.style, args.speed);
  await abhi.synthesizeToFile({ text: args.text, voiceId: args.voiceId, dest: args.dest, speed: s.speed, stability: s.stability, similarity: s.similarity_boost, style: s.style, language: args.language });
  return { alignment: null };
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
  if (providerName() === "abhibots") return `AbhiBots: ${await abhi.ping()}`;
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
