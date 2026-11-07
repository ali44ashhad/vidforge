/**
 * Pipeline stages in execution order. The worker walks through these and
 * saves a checkpoint after each one so a crashed job can resume.
 */
export const PIPELINE_STAGES = [
  "SCRIPTING",
  "STORYBOARDING",
  "VOICE_GENERATION",
  "FETCHING_MEDIA",
  "MUSIC_GENERATION",
  "ASSEMBLING",
  "RENDERING",
  "FINALIZING",
] as const;
export type PipelineStage = (typeof PIPELINE_STAGES)[number];

/** Human labels shown in the generation screen (never expose internals). */
export const STAGE_LABELS: Record<PipelineStage, string> = {
  SCRIPTING: "Writing script",
  STORYBOARDING: "Building storyboard",
  FETCHING_MEDIA: "Finding visuals",
  VOICE_GENERATION: "Generating voiceover",
  MUSIC_GENERATION: "Creating music",
  ASSEMBLING: "Assembling timeline",
  RENDERING: "Rendering video",
  FINALIZING: "Finalizing export",
};

export const DURATION_OPTIONS = [
  { label: "10 seconds", seconds: 10 },
  { label: "15 seconds", seconds: 15 },
  { label: "20 seconds", seconds: 20 },
  { label: "30 seconds", seconds: 30 },
  { label: "45 seconds", seconds: 45 },
  { label: "1 minute", seconds: 60 },
  { label: "90 seconds", seconds: 90 },
  { label: "2 minutes", seconds: 120 },
  { label: "3 minutes", seconds: 180 },
  { label: "5 minutes", seconds: 300 },
  { label: "10 minutes", seconds: 600 },
  { label: "15 minutes", seconds: 900 },
  { label: "20 minutes", seconds: 1200 },
  { label: "30 minutes", seconds: 1800 },
  { label: "45 minutes", seconds: 2700 },
  { label: "60 minutes", seconds: 3600 },
] as const;

export const ASPECT_RATIOS = [
  { value: "R16_9", label: "16:9 YouTube", width: 1920, height: 1080 },
  { value: "R9_16", label: "9:16 Shorts / Reels", width: 1080, height: 1920 },
  { value: "R1_1", label: "1:1 Social", width: 1080, height: 1080 },
  { value: "R4_5", label: "4:5 Social", width: 1080, height: 1350 },
] as const;
export type AspectRatioValue = (typeof ASPECT_RATIOS)[number]["value"];

import { VIDEO_TEMPLATES } from "./templates";
export const VIDEO_TYPES = VIDEO_TEMPLATES.map((t) => t.id);

export const STORY_STYLES = [
  "Storybook illustration", "Soft watercolor", "3D animated movie", "Cartoon", "Paper cut-out", "Crayon drawing", "Pixel art", "Anime",
] as const;

export interface CharacterInput { name: string; description: string; personality?: string; voiceHint?: string; voiceId?: string | null; gender?: string; ageGroup?: string; ethnicity?: string }
export const GENDERS = ["female", "male"] as const;
export const AGE_GROUPS = ["child", "teen", "young adult", "adult", "senior"] as const;

export const VOICE_STYLES = [
  "Professional",
  "Documentary",
  "Conversational",
  "Energetic",
  "Luxury",
  "Warm",
  "Educational",
  "News",
  "Storytelling",
  "Motivational",
] as const;

export const CAPTION_STYLES = [
  "YouTube Clean",
  "Minimal",
  "Bold",
  "Podcast",
  "Word Highlight",
  "Documentary",
  "Corporate",
] as const;

/** Approx spoken words per minute; used only as an estimate for scripting. */
export const WORDS_PER_MINUTE = 145;

export const VISUAL_SOURCES = [
  { value: "mixed", label: "Stock videos + AI images", hint: "Pexels footage; AI image when no good clip exists" },
  { value: "stock_videos", label: "Stock videos only", hint: "Pexels videos, photos as fallback. Free." },
  { value: "ai_images", label: "AI images only", hint: "Every shot generated as an AI image (credits per image)" },
  { value: "ai_video_hero", label: "AI images + AI video for key shots", hint: "First shot of every scene becomes a real AI video clip (Veo), the rest are animated images. Video clips cost far more than images." },
  { value: "ai_videos", label: "AI video for every shot", hint: "Every shot generated as an 8-second AI video clip from its image. Highest quality, highest cost and slowest." },
] as const;

export const IMAGE_STYLES = [
  "Cinematic photo", "Documentary photo", "Clean corporate", "Editorial illustration", "3D render", "Flat vector", "Watercolor", "Dark moody", "Bright and airy",
] as const;

export const MUSIC_STYLES = [
  "Auto", "Cinematic", "Ambient", "Corporate", "Upbeat pop", "Lo-fi", "Suspense", "Emotional piano", "Epic orchestral", "Electronic tech", "Acoustic", "Custom",
] as const;

export const LOGO_POSITIONS = [
  { value: "top_right", label: "Top right" }, { value: "top_left", label: "Top left" },
  { value: "bottom_right", label: "Bottom right" }, { value: "bottom_left", label: "Bottom left" },
] as const;

export type MixSettings = { voiceVolume: number; musicVolume: number; duck: number; fadeIn: number; fadeOut: number };
export const DEFAULT_MIX: MixSettings = { voiceVolume: 1.0, musicVolume: 0.22, duck: 6, fadeIn: 2, fadeOut: 3 };

export const OUTPUT_QUALITIES = [
  { value: "720p", label: "720p (fast)", long: 1280 },
  { value: "1080p", label: "1080p Full HD", long: 1920 },
  { value: "4k", label: "4K Ultra HD (slow, large file)", long: 3840 },
] as const;

/** Frame size for an aspect ratio at a quality (long side from OUTPUT_QUALITIES, even numbers). */
export function frameSize(aspect: string, quality: string): { width: number; height: number } {
  const q = OUTPUT_QUALITIES.find((x) => x.value === quality) ?? OUTPUT_QUALITIES[1];
  const r = { R16_9: [16, 9], R9_16: [9, 16], R1_1: [1, 1], R4_5: [4, 5] }[aspect] ?? [16, 9];
  const long = q.long;
  const even = (n: number) => Math.round(n / 2) * 2;
  if (r[0] >= r[1]) return { width: long, height: even((long * r[1]) / r[0]) };
  return { width: even((long * r[0]) / r[1]), height: long };
}

/** Spoken words per minute at normal speed, by language (narration pace, not reading pace). */
export const SPEECH_RATES: Record<string, number> = {
  english: 150, hindi: 125, punjabi: 125, spanish: 160, french: 155, german: 140, portuguese: 155, arabic: 130, japanese: 140, italian: 155,
};
export function speechRate(language: string): number {
  const k = (language || "").toLowerCase().trim();
  return SPEECH_RATES[k] ?? SPEECH_RATES[Object.keys(SPEECH_RATES).find((x) => k.startsWith(x)) ?? ""] ?? WORDS_PER_MINUTE;
}

export type ReferenceKind = "subject" | "style" | "location" | "character";
export type ReferenceImage = { url: string; path: string; kind: ReferenceKind; label: string };
export const REFERENCE_KINDS: { value: ReferenceKind; label: string; hint: string }[] = [
  { value: "subject", label: "Subject / product", hint: "Must appear exactly as shown in every shot (product, logo, mascot)" },
  { value: "character", label: "Character", hint: "A person or character to keep consistent (face, outfit)" },
  { value: "location", label: "Location / set", hint: "The place or environment scenes happen in" },
  { value: "style", label: "Style frame", hint: "Match its colours, lighting and art style — not its content" },
];

/** Languages supported by ElevenLabs multilingual_v2; anything else needs eleven_v3. */
export const ELEVEN_V2_LANGS = ["english","hindi","spanish","french","german","portuguese","arabic","japanese","italian","chinese","korean","dutch","turkish","polish","swedish","filipino","malay","romanian","ukrainian","greek","czech","danish","finnish","bulgarian","croatian","slovak","tamil","indonesian","russian","hungarian","norwegian","vietnamese"];
export function ttsModelFor(language: string, configured: string): string {
  const k = (language || "").toLowerCase().trim();
  const v2ok = ELEVEN_V2_LANGS.some((l) => k.startsWith(l));
  return v2ok ? configured : "eleven_v3";
}

/** Writing-system rules per language, used to keep DeepSeek in the right script. */
export const SCRIPT_RULES: Record<string, { name: string; range: RegExp; forbid: string }> = {
  hindi: { name: "Devanagari", range: /[\u0900-\u097F]/g, forbid: "Do not use Gurmukhi, Urdu or Roman transliteration; common English brand/tech words may stay in Latin letters." },
  punjabi: { name: "Gurmukhi", range: /[\u0A00-\u0A7F]/g, forbid: "Do NOT use Hindi words or Devanagari letters at all; this is Punjabi, not Hindi. Common English brand/tech words may stay in Latin letters." },
  arabic: { name: "Arabic", range: /[\u0600-\u06FF]/g, forbid: "Do not use Roman transliteration." },
  japanese: { name: "Japanese (kanji/kana)", range: /[\u3040-\u30FF\u4E00-\u9FFF]/g, forbid: "Do not use romaji." },
  tamil: { name: "Tamil", range: /[\u0B80-\u0BFF]/g, forbid: "Do not use Devanagari or Roman transliteration." },
  gujarati: { name: "Gujarati", range: /[\u0A80-\u0AFF]/g, forbid: "Do not use Devanagari." },
  bengali: { name: "Bengali", range: /[\u0980-\u09FF]/g, forbid: "Do not use Devanagari." },
};
export function scriptRuleFor(language: string) {
  const k = (language || "").toLowerCase().trim();
  const key = Object.keys(SCRIPT_RULES).find((x) => k.startsWith(x));
  return key ? SCRIPT_RULES[key] : null;
}
/** Fraction of letters that are in a wrong (non-target, non-Latin) script. 0 = clean. */
export function wrongScriptRatio(language: string, text: string): number {
  const rule = scriptRuleFor(language);
  if (!rule) return 0;
  const letters = text.match(/\p{L}/gu) ?? [];
  if (!letters.length) return 0;
  const target = (text.match(rule.range) ?? []).length;
  const latin = (text.match(/[A-Za-z]/g) ?? []).length;
  return Math.max(0, (letters.length - target - latin) / letters.length);
}

export const LANGUAGES = ["English", "Hindi", "Punjabi", "Spanish", "French", "German", "Portuguese", "Arabic", "Japanese", "Italian"] as const;
