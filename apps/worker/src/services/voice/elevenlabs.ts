/**
 * ElevenLabs text-to-speech with word timestamps.
 * Each scene is generated separately (reliable for long videos) with
 * previous/next text passed for continuity between segments.
 */
import fs from "node:fs";
import { env, requireKey } from "../../env";
import { ttsModelFor } from "@vidforge/shared";
import { fetchJson } from "../../lib/http";

const BASE = env.VOICE_API_BASE_URL;

function authHeaders(): Record<string, string> {
  const key = requireKey("ELEVENLABS_API_KEY");
  return env.VOICE_AUTH_STYLE === "bearer" ? { Authorization: `Bearer ${key}` } : { "xi-api-key": key };
}

export interface VoiceInfo { voice_id: string; name: string; labels?: Record<string, string>; category?: string }

export async function listVoices(): Promise<VoiceInfo[]> {
  const data = await fetchJson<{ voices: VoiceInfo[] }>(`${BASE}/voices`, { headers: authHeaders() });
  return data.voices ?? [];
}

/** Well-known ElevenLabs premade voices, matched to our voice styles. */
export const STYLE_DEFAULTS: Record<string, string[]> = {
  Professional: ["JBFqnCBsd6RMkjVDRZzb", "onwK4e9ZLuTAKqWW03F9"], // George, Daniel
  Documentary: ["JBFqnCBsd6RMkjVDRZzb", "nPczCjzI2devNBz1zQrb"], // George, Brian
  Conversational: ["pNInz6obpgDQGcFmaJgB", "21m00Tcm4TlvDq8ikWAM"], // Adam, Rachel
  Energetic: ["pNInz6obpgDQGcFmaJgB", "XB0fDUnXU5powFXDhCwa"],
  Luxury: ["XB0fDUnXU5powFXDhCwa", "JBFqnCBsd6RMkjVDRZzb"], // Charlotte
  Warm: ["XrExE9yKIg1WjnnlVkGX", "pFZP5JQG7iQjIQuC4Bku"], // Matilda, Lily
  Educational: ["21m00Tcm4TlvDq8ikWAM", "onwK4e9ZLuTAKqWW03F9"],
  News: ["onwK4e9ZLuTAKqWW03F9", "nPczCjzI2devNBz1zQrb"],
  Storytelling: ["nPczCjzI2devNBz1zQrb", "XrExE9yKIg1WjnnlVkGX"],
  Motivational: ["pNInz6obpgDQGcFmaJgB", "nPczCjzI2devNBz1zQrb"],
};

/** Picks a voice: explicit project voice → env default → style default that exists on the account → first voice. */
export async function resolveVoiceId(style: string, projectVoiceId?: string | null): Promise<string> {
  const voices = await listVoices();
  const ids = new Set(voices.map((v) => v.voice_id));
  if (projectVoiceId && ids.has(projectVoiceId)) return projectVoiceId;
  if (env.ELEVENLABS_VOICE_ID && ids.has(env.ELEVENLABS_VOICE_ID)) return env.ELEVENLABS_VOICE_ID;
  for (const id of STYLE_DEFAULTS[style] ?? []) if (ids.has(id)) return id;
  if (voices[0]) return voices[0].voice_id;
  throw new Error("No ElevenLabs voices available on this account");
}

export interface Alignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

export interface TtsResult { alignment: Alignment | null; requestId?: string }

export function settingsForStyle(style: string, speed: number) {
  const base = { stability: 0.5, similarity_boost: 0.75, style: 0.0, use_speaker_boost: true, speed: Math.min(1.2, Math.max(0.7, speed)) };
  if (style === "Energetic" || style === "Motivational") return { ...base, stability: 0.35, style: 0.35 };
  if (style === "Documentary" || style === "Luxury") return { ...base, stability: 0.65 };
  return base;
}

/** Generates one segment as MP3 on disk and returns character-level timestamps. */
export async function synthesizeToFile(args: {
  text: string; voiceId: string; style: string; speed: number; dest: string;
  previousText?: string; nextText?: string; languageCode?: string; language?: string;
}): Promise<TtsResult> {
  const url = `${BASE}/text-to-speech/${args.voiceId}/with-timestamps?output_format=mp3_44100_128`;
  const body: Record<string, unknown> = {
    text: args.text,
    model_id: ttsModelFor(args.language || "English", env.ELEVENLABS_MODEL_ID),
    voice_settings: settingsForStyle(args.style, args.speed),
  };
  if (args.previousText) body.previous_text = args.previousText.slice(-500);
  if (args.nextText) body.next_text = args.nextText.slice(0, 500);

  const data = await fetchJson<{ audio_base64: string; alignment: Alignment | null; normalized_alignment?: Alignment | null }>(url, {
    method: "POST",
    headers: { ...authHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  fs.writeFileSync(args.dest, Buffer.from(data.audio_base64, "base64"));
  return { alignment: data.alignment ?? data.normalized_alignment ?? null };
}

/** Converts character timestamps into word timestamps for captions. */
export function alignmentToWords(a: Alignment | null): { word: string; start: number; end: number }[] {
  if (!a) return [];
  const words: { word: string; start: number; end: number }[] = [];
  let cur = "", start = 0, end = 0;
  for (let i = 0; i < a.characters.length; i++) {
    const ch = a.characters[i];
    if (/\s/.test(ch)) {
      if (cur) words.push({ word: cur, start, end });
      cur = "";
    } else {
      if (!cur) start = a.character_start_times_seconds[i];
      cur += ch;
      end = a.character_end_times_seconds[i];
    }
  }
  if (cur) words.push({ word: cur, start, end });
  return words;
}

