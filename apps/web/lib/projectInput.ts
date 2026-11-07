import { ASPECT_RATIOS, VIDEO_TYPES, VOICE_STYLES, VISUAL_SOURCES, MUSIC_STYLES, CAPTION_STYLES, LOGO_POSITIONS, DEFAULT_MIX, LOOKS, DEFAULT_LOOK, type MixSettings, type CharacterInput } from "@vidforge/shared";
import type { Prisma } from "@vidforge/db";

const inList = (list: readonly string[], v: unknown, fallback: string) => (typeof v === "string" && list.includes(v) ? v : fallback);
const num = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

/** Parses the settings shared by "create" and "update" into a Prisma-ready object. Throws on bad values. */
export function parseSettings(body: Record<string, unknown>) {
  const mixIn = (body.mixSettings ?? {}) as Partial<MixSettings>;
  const mixSettings: MixSettings = {
    voiceVolume: num(mixIn.voiceVolume, 0.2, 2, DEFAULT_MIX.voiceVolume),
    musicVolume: num(mixIn.musicVolume, 0, 1, DEFAULT_MIX.musicVolume),
    duck: num(mixIn.duck, 1, 20, DEFAULT_MIX.duck),
    fadeIn: num(mixIn.fadeIn, 0, 10, DEFAULT_MIX.fadeIn),
    fadeOut: num(mixIn.fadeOut, 0, 15, DEFAULT_MIX.fadeOut),
  };
  const videoType = inList(VIDEO_TYPES, body.videoType, "YouTube Video");
  const narrationMode = body.narrationMode === "characters_only" ? "characters_only" : body.narrationMode === "characters" ? "characters" : body.narrationMode === "narrator" ? "narrator" : (videoType === "Kids Story" ? "characters" : "narrator");
  const storyMode = narrationMode !== "narrator";
  const narratorEnabled = narrationMode !== "characters_only";
  const characters: CharacterInput[] = Array.isArray(body.characters)
    ? (body.characters as Record<string, unknown>[])
        .map((c) => ({
          name: String(c.name ?? "").trim().slice(0, 40),
          description: String(c.description ?? "").trim().slice(0, 500),
          personality: String(c.personality ?? "").trim().slice(0, 200) || undefined,
          voiceHint: String(c.voiceHint ?? "").trim().slice(0, 100) || undefined,
          voiceId: typeof c.voiceId === "string" && c.voiceId ? c.voiceId : null,
          gender: inList(["female", "male"], c.gender, "") || undefined,
          ageGroup: inList(["child", "teen", "young adult", "adult", "senior"], c.ageGroup, "") || undefined,
          ethnicity: String(c.ethnicity ?? "").trim().slice(0, 80) || undefined,
        }))
        .filter((c) => c.name && c.description.length >= 10)
    : [];
  const presenterMode = body.presenterMode === "ai" && body.presenterImageUrl ? "ai" : "off";
  return {
    presenterMode, presenterImageUrl: presenterMode === "ai" ? String(body.presenterImageUrl) : null, presenterImagePath: presenterMode === "ai" ? String(body.presenterImagePath ?? "") || null : null,
    presenterPosition: ["bottom_left", "bottom_right", "top_left", "top_right"].includes(String(body.presenterPosition)) ? String(body.presenterPosition) : "bottom_left",
    presenterSize: Math.min(75, Math.max(12, Number(body.presenterSize ?? 34))), presenterShape: body.presenterShape === "cutout" ? "cutout" : "circle", presenterRing: /^#[0-9a-f]{6}$/i.test(String(body.presenterRing)) ? String(body.presenterRing) : "#6C4CFF",
    storyMode,
    narratorEnabled,
    speechMode: body.speechMode === "veo_native" ? "veo_native" : "tts",
    allowStockFallback: body.allowStockFallback === true,
    scriptVerbatim: body.scriptVerbatim === true,
    banners: (body.banners && typeof body.banners === "object"
      ? { top: String((body.banners as Record<string, unknown>).top ?? "").slice(0, 60), topHighlight: String((body.banners as Record<string, unknown>).topHighlight ?? "").slice(0, 20),
          bottom: String((body.banners as Record<string, unknown>).bottom ?? "").slice(0, 60), color: String((body.banners as Record<string, unknown>).color ?? "#FF7A00").slice(0, 9) }
      : undefined) as Prisma.InputJsonValue | undefined,
    referenceImages: Array.isArray(body.referenceImages)
      ? (body.referenceImages as Record<string, unknown>[]).slice(0, 4).map((r) => ({
          url: String(r.url ?? ""), path: String(r.path ?? ""),
          kind: inList(["subject", "style", "location", "character"], r.kind, "subject"), label: String(r.label ?? "").slice(0, 60),
        })).filter((r) => r.url || r.path) as unknown as Prisma.InputJsonValue
      : ([] as unknown as Prisma.InputJsonValue),
    outputQuality: inList(["720p", "1080p", "4k"], body.outputQuality, "1080p"),
    aiVideoResolution: inList(["720p", "1080p"], body.aiVideoResolution, "720p"),
    voiceEnabled: body.voiceEnabled !== false,
    look: inList(LOOKS.map((l) => l.id), body.look, DEFAULT_LOOK),
    lookParams: body.lookParams && typeof body.lookParams === "object" ? (body.lookParams as Prisma.InputJsonValue) : undefined,
    lookIntensity: Math.round(num(body.lookIntensity, 0, 150, 70)),
    textOverlaysEnabled: body.textOverlaysEnabled !== false,
    characterVoices: body.characterVoices !== false,
    characterCount: Math.min(4, Math.max(1, num(body.characterCount, 1, 4, 2))),
    characters,
    aspectRatio: inList(ASPECT_RATIOS.map((a) => a.value), body.aspectRatio, "R16_9") as "R16_9" | "R9_16" | "R1_1" | "R4_5",
    videoType,
    language: typeof body.language === "string" && body.language.trim() ? body.language.trim().slice(0, 40) : "English",
    voiceStyle: inList(VOICE_STYLES, body.voiceStyle, "Professional"),
    voiceId: typeof body.voiceId === "string" && body.voiceId.trim() ? body.voiceId.trim() : null,
    voiceSpeed: num(body.voiceSpeed, 0.7, 1.2, 1.0),
    visualSource: inList(VISUAL_SOURCES.map((v) => v.value), body.visualSource, "mixed") as string,
    imageStyle: typeof body.imageStyle === "string" && body.imageStyle.trim() ? body.imageStyle.trim().slice(0, 120) : null,
    musicEnabled: body.musicEnabled !== false,
    musicStyle: inList(MUSIC_STYLES, body.musicStyle, "Auto"),
    musicCustomPrompt: typeof body.musicCustomPrompt === "string" && body.musicCustomPrompt.trim() ? body.musicCustomPrompt.trim().slice(0, 500) : null,
    mixSettings: mixSettings as unknown as Prisma.InputJsonValue,
    captionsEnabled: body.captionsEnabled !== false,
    captionStyle: inList(CAPTION_STYLES, body.captionStyle, "YouTube Clean"),
    cta: typeof body.cta === "string" && body.cta.trim() ? body.cta.trim().slice(0, 300) : null,
    logoUrl: typeof body.logoUrl === "string" && body.logoUrl ? body.logoUrl : null,
    logoPath: typeof body.logoPath === "string" && body.logoPath ? body.logoPath : null,
    logoPosition: inList(LOGO_POSITIONS.map((l) => l.value), body.logoPosition, "top_right"),
  };
}
