import { z } from "zod";

/**
 * Structured output we require from DeepSeek ("the director").
 * Everything downstream (Pexels search, voice, timing, render) reads this shape.
 * Phase 2 fills in the DeepSeek service that produces it.
 */
export const ShotSchema = z.object({
  duration: z.number().positive(),
  visualDescription: z.string().min(1),
  pexelsVideoQueries: z.array(z.string().min(1)).min(1).max(6),
  pexelsImageQueries: z.array(z.string().min(1)).max(6).default([]),
  transition: z
    .enum(["cut", "dissolve", "fade", "dip_to_black", "zoom", "blur", "slide"])
    .default("cut"),
  motion: z
    .enum(["none", "zoom_in", "zoom_out", "pan_left", "pan_right", "ken_burns"])
    .default("zoom_in"),
  onScreenText: z.string().default(""),
  characters: z.array(z.string()).default([]),
  dialogue: z.string().default(""),
});
export type Shot = z.infer<typeof ShotSchema>;

export const SceneSchema = z.object({
  narration: z.string().min(1),
  shots: z.array(ShotSchema).min(1),
});
export type Scene = z.infer<typeof SceneSchema>;

export const ChapterSchema = z.object({
  title: z.string().min(1),
  musicMood: z.string().default(""),
  scenes: z.array(SceneSchema).min(1),
});
export type Chapter = z.infer<typeof ChapterSchema>;

export const StoryboardSchema = z.object({
  projectTitle: z.string().min(1),
  tone: z.string().default("professional"),
  musicPrompt: z.string().min(1),
  chapters: z.array(ChapterSchema).min(1),
});
export type Storyboard = z.infer<typeof StoryboardSchema>;

export const StrategySchema = z.object({
  title: z.string().min(1),
  hook: z.string().min(1),
  audience: z.string().min(1),
  tone: z.string().min(1),
  pacing: z.enum(["energetic", "normal", "cinematic"]).default("normal"),
  targetWords: z.number().int().positive(),
  outline: z
    .array(z.object({ title: z.string().min(1), summary: z.string().min(1) }))
    .min(1),
  cta: z.string().default(""),
});
export type Strategy = z.infer<typeof StrategySchema>;

export const LineSchema = z.object({ speaker: z.string().min(1), text: z.string().min(1) });
export type Line = z.infer<typeof LineSchema>;

export const CharacterSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(10),
  personality: z.string().default(""),
  voiceHint: z.string().default(""),
  gender: z.enum(["female", "male"]).default("female"),
  ageGroup: z.enum(["child", "teen", "young adult", "adult", "senior"]).default("adult"),
  ethnicity: z.string().default(""),
});
export type CharacterSpec = z.infer<typeof CharacterSchema>;
