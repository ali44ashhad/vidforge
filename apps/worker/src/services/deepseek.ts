/**
 * DeepSeek = the "director": strategy, script, and shot planning.
 * All calls request strict JSON and are validated with Zod; invalid output is
 * sent back to the model once for repair before we give up.
 */
import { z } from "zod";
import { env, requireKey } from "../env";
import { fetchJson } from "../lib/http";
import { StrategySchema, ShotSchema, LineSchema, CharacterSchema, WORDS_PER_MINUTE, speechRate, scriptRuleFor, findStyle, findTemplate, VIDEO_TEMPLATES, type VideoTemplate, type Strategy, type CharacterSpec, type Line } from "@vidforge/shared";

function languageRule(language: string): string {
  const r = scriptRuleFor(language);
  return r ? ` LANGUAGE RULE: write ONLY in ${language} using the ${r.name} script. ${r.forbid}` : ` Write in ${language}.`;
}

const API = "https://api.deepseek.com/chat/completions";

type Msg = { role: "system" | "user" | "assistant"; content: string };

async function chatJson(messages: Msg[], maxTokens = 8000, temperature = 0.7): Promise<string> {
  const key = requireKey("DEEPSEEK_API_KEY");
  const data = await fetchJson<{ choices: { message: { content: string } }[] }>(API, {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: env.DEEPSEEK_MODEL,
      messages,
      temperature,
      max_tokens: maxTokens,
      response_format: { type: "json_object" },
    }),
  });
  return data.choices[0]?.message?.content ?? "";
}

function extractJson(text: string): unknown {
  const trimmed = text.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  try { return JSON.parse(trimmed); } catch { /* fallthrough */ }
  const start = trimmed.indexOf("{"), end = trimmed.lastIndexOf("}");
  if (start >= 0 && end > start) return JSON.parse(trimmed.slice(start, end + 1));
  throw new Error("No JSON object found in model output");
}

/** Public generic helper for other services (SEO kit etc.). */
export async function askJson<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, system: string, user: string, maxTokens = 4000): Promise<T> {
  return askValidated(schema, system, user, maxTokens);
}

/** Ask, validate, and if invalid ask the model to repair its own output (once). */
export async function askValidated<T>(schema: z.ZodType<T, z.ZodTypeDef, unknown>, system: string, user: string, maxTokens = 8000): Promise<T> {
  const messages: Msg[] = [{ role: "system", content: system }, { role: "user", content: user }];
  let raw = await chatJson(messages, maxTokens);
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      return schema.parse(extractJson(raw));
    } catch (e) {
      const issue = e instanceof Error ? e.message.slice(0, 1500) : String(e);
      messages.push({ role: "assistant", content: raw });
      messages.push({ role: "user", content: `Your JSON was invalid: ${issue}\nReturn the corrected JSON only.` });
      raw = await chatJson(messages, maxTokens, 0.3);
    }
  }
  return schema.parse(extractJson(raw));
}

// ---------------------------------------------------------------------------
// 1. Strategy: title, hook, chapter outline with word budgets
// ---------------------------------------------------------------------------

export interface StrategyInput {
  prompt: string;
  targetDuration: number; // seconds
  videoType: string;
  language: string;
  voiceStyle: string;
  voiceSpeed: number;
  aspectRatio: string;
  cta?: string | null;
  story?: { characterCount: number; givenCharacters: CharacterSpec[]; style: string };
  template?: VideoTemplate | null;
}

export type StrategyWithCharacters = Strategy & { outline: { title: string; summary: string; targetWords: number }[]; characters: CharacterSpec[] };

export async function createStrategy(input: StrategyInput): Promise<StrategyWithCharacters> {
  const minutes = input.targetDuration / 60;
  const rate = speechRate(input.language);
  const targetWords = Math.max(15, Math.round(minutes * rate * input.voiceSpeed));
  const chapterCount = Math.max(1, Math.min(20, Math.round(minutes / 2.5)));
  const shortForm = input.targetDuration <= 90;

  const story = input.story;
  const kids = input.videoType === "Kids Story";
  const system = story
    ? kids
      ? `You are a children's author and animation director. You create warm, simple, engaging stories for kids (ages 4-9) with clear characters, a small problem, and a gentle lesson. Respond with JSON only.`
      : `You are a senior video director who writes character-driven ${input.videoType} videos: a narrator plus recurring on-screen characters (hosts, presenters, customers, experts or story figures) who speak in their own voices. Characters must serve the video's goal (explain, persuade, inform, entertain). Respond with JSON only.`
    : `You are a senior YouTube video director and scriptwriter. You plan videos for maximum viewer retention.
Respond with JSON only.`;
  const template = input.template ?? findTemplate(input.videoType);
  const playbook = template ? `\nFORMAT PLAYBOOK (${template.name}) — follow this, it is what performs for this format: ${template.playbook}` : "";
  const characterBlock = story
    ? `\nCHARACTERS: ${story.givenCharacters.length
        ? `Use exactly these characters (you may add up to ${Math.max(0, story.characterCount - story.givenCharacters.length)} more): ${JSON.stringify(story.givenCharacters)}`
        : `Invent ${story.characterCount} characters.`}
Return them in "characters": [{ "name", "gender" ("female"|"male"), "ageGroup" ("child"|"teen"|"young adult"|"adult"|"senior"), "ethnicity" (nationality/region and skin tone appropriate to the audience and language, e.g. "Punjabi Indian, medium skin tone"), "description" (visual: species/age, hair, eyes, outfit, colours — precise enough to draw the same character every time; must agree with gender/ageGroup/ethnicity), "personality", "voiceHint" (e.g. "young girl, cheerful, high voice") }]. For characters the user already gave, keep their gender, ageGroup and ethnicity EXACTLY.
Visual style of the illustrations: ${story.style}.`
    : "";
  const user = `Plan a ${input.videoType} in ${input.language}.
Requested length: ${input.targetDuration} seconds — EXACTLY ${targetWords} spoken words in total (${Math.round(rate * input.voiceSpeed)} wpm for ${input.language}). This is a hard limit: the video must not run long.
Format: ${input.aspectRatio === "R9_16" ? "vertical short-form" : "landscape"}.
Narration voice style: ${input.voiceStyle}.
${input.cta ? `Call to action at the end: ${input.cta}` : ""}

User's request:
"""
${input.prompt}
"""

Return this exact JSON shape:
{
  "title": "final video title (max 70 chars, no hashtags)",
  "hook": "the first 1-2 sentences that will be spoken, designed to stop the viewer scrolling",
  "audience": "who this is for",
  "tone": "e.g. professional documentary / energetic / warm educational",
  "pacing": "${template?.pacing ?? (shortForm ? "energetic" : "normal")}",
  "targetWords": ${targetWords},
  "outline": [
    { "title": "chapter title", "summary": "2-3 sentences on what this chapter covers and its role in the story arc", "targetWords": number }
  ],
  "cta": "closing call to action sentence"${story ? `,\n  "characters": [ ... ]` : ""},
  "finishing": {
    "grade": { "contrast": -1..1, "saturation": -1..1, "brightness": -1..1, "warmth": -1..1 (negative = cool/blue), "sharpen": 0..1, "vignette": 0..1, "grain": 0..1, "leak": 0..1 (warm light leak) } — choose for THIS topic AND platform:
      • vertical / Shorts / Reels / ads / product / kids / explainers → BRIGHT and CLEAN: brightness 0.2-0.4, saturation 0.3-0.6, contrast 0.1-0.3, sharpen 0.5-0.7, vignette 0, grain 0, leak 0
      • documentary / travel / motivational (landscape) → cinematic but not dull: contrast 0.3, saturation 0.1-0.2, warmth 0.2, vignette 0.3-0.5, grain 0.2, leak 0.3
      • horror / thriller / noir → contrast 0.5, saturation -0.3, warmth -0.5, vignette 0.7, grain 0.4, brightness -0.2
      • vintage / history → warmth 0.4, saturation -0.2, grain 0.6, vignette 0.5,
    "musicStyle": one of Cinematic | Ambient | Corporate | Upbeat pop | Lo-fi | Suspense | Emotional piano | Epic orchestral | Electronic tech | Acoustic,
    "captionStyle": one of YouTube Clean | Minimal | Bold | Podcast | Word Highlight | Documentary | Corporate,
    "reason": "one sentence"
  }
}${characterBlock}${playbook}
Rules:
- Exactly ${chapterCount} chapters (${shortForm ? "a short video is one chapter: no intro, no outro, hook is the first sentence" : "first chapter is a fast hook + intro, last chapter is the conclusion with CTA"}).
- Chapter targetWords must add up to ${targetWords}.
- Build a narrative progression; avoid an essay structure.`;

  const StrategyWithWords = StrategySchema.extend({
    outline: z.array(z.object({ title: z.string().min(1), summary: z.string().min(1), targetWords: z.number().int().positive() })).min(1),
    characters: z.array(CharacterSchema).default([]),
    finishing: z.object({
      grade: z.object({
        contrast: z.number().min(-1).max(1).default(0.2), saturation: z.number().min(-1).max(1).default(0.3), brightness: z.number().min(-1).max(1).default(0.1),
        warmth: z.number().min(-1).max(1).default(0.1), sharpen: z.number().min(0).max(1).default(0.5), vignette: z.number().min(0).max(1).default(0),
        grain: z.number().min(0).max(1).default(0), leak: z.number().min(0).max(1).default(0),
      }).default({}),
      musicStyle: z.enum(["Cinematic", "Ambient", "Corporate", "Upbeat pop", "Lo-fi", "Suspense", "Emotional piano", "Epic orchestral", "Electronic tech", "Acoustic"]).default("Cinematic"),
      captionStyle: z.enum(["YouTube Clean", "Minimal", "Bold", "Podcast", "Word Highlight", "Documentary", "Corporate"]).default("YouTube Clean"),
      reason: z.string().default(""),
    }).optional(),
  });
  const s = await askValidated(StrategyWithWords, system, user, 4000);
  // Normalise word budgets so they sum to targetWords
  const sum = s.outline.reduce((a, c) => a + c.targetWords, 0) || 1;
  s.outline = s.outline.map((c) => ({ ...c, targetWords: Math.max(40, Math.round((c.targetWords / sum) * targetWords)) }));
  s.targetWords = targetWords;
  return s;
}

// ---------------------------------------------------------------------------
// 2. Chapter script: narration split into scenes (paragraphs)
// ---------------------------------------------------------------------------

const ChapterScriptSchema = z.object({
  scenes: z.array(z.object({ narration: z.string().min(1) })).min(1),
});
const StoryChapterSchema = z.object({
  scenes: z.array(z.object({ lines: z.array(LineSchema).min(1) })).min(1),
});

/** Story mode: scenes made of narrator/character lines. */
export async function writeStoryChapter(args: {
  strategy: StrategyWithCharacters; chapterIndex: number; language: string; previousChapterEnding?: string; videoType?: string; narratorEnabled?: boolean;
}): Promise<Line[][]> {
  const { strategy, chapterIndex } = args;
  const chapter = strategy.outline[chapterIndex];
  const isFirst = chapterIndex === 0, isLast = chapterIndex === strategy.outline.length - 1;
  const words = chapter.targetWords ?? Math.round(strategy.targetWords / strategy.outline.length);
  const names = strategy.characters.map((c) => c.name);
  const kids = /kid|child/i.test(strategy.audience) || /story/i.test(args.videoType ?? "");
  const system = (kids
    ? `You write children's stories that are read aloud by a narrator with separate voice actors for each character. Simple words, short sentences, warmth and humour. No markdown. Write numbers and times as spoken words in ${args.language}. Respond with JSON only.`
    : `You write spoken scripts for a ${args.videoType ?? "video"} performed by a narrator plus voice actors for each character. Natural spoken dialogue, no stage directions, no markdown. The characters carry the explanation or story; the narrator connects and clarifies. Write every number, time, date and unit exactly as spoken in ${args.language} (Hindi: "दो बजकर सत्रह मिनट", never "2:17"). Respond with JSON only.`) + languageRule(args.language);
  const user = `Story: ${strategy.title}. Language: ${args.language}. Audience: ${strategy.audience}.
Characters: ${strategy.characters.map((c) => `${c.name} — ${c.personality || c.description}`).join("; ")}
Outline: ${strategy.outline.map((c, i) => `${i + 1}. ${c.title}`).join(" | ")}

Write part ${chapterIndex + 1}: "${chapter.title}" — ${chapter.summary}
Target: ${words} words — this is a MINIMUM, not a maximum: write at least ${words} words, with enough exchanges and narrator detail to fill it. Short scripts are rejected.
${isFirst ? `Open with this hook: "${strategy.hook}".` : ""}${args.previousChapterEnding ? ` Continue from: "${args.previousChapterEnding}".` : ""}
${isLast ? `End with a satisfying conclusion and this closing line: "${strategy.cta}".` : "Do not conclude yet."}

Split into scenes of 40-80 words. Each scene is a list of lines. ${args.narratorEnabled === false
  ? `There is NO narrator: every line's "speaker" must be exactly one of: ${names.join(", ")}. Characters speak directly to each other or to the camera; convey setting and action through what they say.`
  : `"speaker" is "narrator" or exactly one of: ${names.join(", ")}.
Character lines contain ONLY the spoken words (no quotes, no "she said"). Mix narration and dialogue naturally; at least a third of the lines should be dialogue.`}
Return: { "scenes": [ { "lines": [ { "speaker": "narrator", "text": "..." }, { "speaker": "${names[0] ?? "Name"}", "text": "..." } ] } ] }`;
  const out = await askValidated(StoryChapterSchema, system, user, 6000);
  const fallback = args.narratorEnabled === false ? names[0] : "narrator";
  return out.scenes.map((s) => s.lines.map((l) => ({ speaker: names.includes(l.speaker) ? l.speaker : fallback, text: l.text.trim() })).filter((l) => l.text));
}

export async function writeChapterScript(args: {
  strategy: Strategy & { outline: { title: string; summary: string; targetWords?: number }[] };
  chapterIndex: number;
  language: string;
  voiceStyle: string;
  previousChapterEnding?: string;
  videoType?: string;
  template?: VideoTemplate | null;
}): Promise<string[]> {
  const { strategy, chapterIndex } = args;
  const chapter = strategy.outline[chapterIndex];
  const isFirst = chapterIndex === 0;
  const isLast = chapterIndex === strategy.outline.length - 1;
  const words = chapter.targetWords ?? Math.round(strategy.targetWords / strategy.outline.length);

  const tpl = args.template ?? findTemplate(args.videoType);
  const system = `You write narration scripts that are SPOKEN ALOUD by a voice actor.${languageRule(args.language)}${tpl ? ` Format: ${tpl.name}. Playbook: ${tpl.playbook}` : ""} Natural sentences, conversational transitions, short paragraphs, speech-friendly punctuation. Never use bullet points, headings, markdown, stage directions, or phrases like "as shown above". Write every number, time, date, price and unit exactly as it is spoken in ${args.language} (e.g. in Hindi "रात दो बजकर सत्रह मिनट", never "2:17"; "पचास प्रतिशत", never "50%"). Respond with JSON only.`;
  const user = `Video title: ${strategy.title}
Tone: ${strategy.tone}. Voice style: ${args.voiceStyle}. Language: ${args.language}. Audience: ${strategy.audience}.
Full outline: ${strategy.outline.map((c, i) => `${i + 1}. ${c.title}`).join(" | ")}

Write chapter ${chapterIndex + 1}: "${chapter.title}"
What it covers: ${chapter.summary}
Target length: ${words} words — stay within ±10% (this sets the video length; do not add material to fill).
${isFirst ? `Start with this hook (you may polish it): "${strategy.hook}". Get into the content quickly, no long intro.` : ""}
${args.previousChapterEnding ? `The previous chapter ended with: "${args.previousChapterEnding}" — continue naturally.` : ""}
${isLast ? `End the video with a clear conclusion and this call to action: "${strategy.cta}".` : "Do NOT conclude the whole video; hand over to the next chapter."}

Split the narration into scenes of 35-80 words each (one idea per scene). Use occasional questions and pattern interrupts to hold attention.
Return: { "scenes": [ { "narration": "..." } ] }`;

  const out = await askValidated(ChapterScriptSchema, system, user, 6000);
  return out.scenes.map((s) => s.narration.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// 3. Shot planning for one chapter
// ---------------------------------------------------------------------------

const ChapterShotsSchema = z.object({
  musicMood: z.string().default(""),
  scenes: z.array(z.object({ index: z.number().int().min(0), shots: z.array(ShotSchema).min(1) })).min(1),
});

export async function planChapterShots(args: {
  title: string;
  chapterTitle: string;
  tone: string;
  pacing: "energetic" | "normal" | "cinematic";
  aspectRatio: string;
  scenes: string[];
  voiceSpeed: number;
  characters?: CharacterSpec[];
  storyStyle?: string;
  maxShotSeconds?: number;
  noVoice?: boolean;
  styleName?: string;
  wholeClips?: boolean;
  /** Short-form fast-cut window: every shot must last between min and max seconds. */
  shotSeconds?: { min: number; max: number } | null;
  language?: string;
  presenterMode?: boolean;
  nativeSpeech?: { lines: { speaker: string; text: string }[][] } | null;
}): Promise<z.infer<typeof ChapterShotsSchema>> {
  const preset = findStyle(args.styleName);
  const wps = (speechRate(args.language ?? "English") * args.voiceSpeed) / 60;
  const story = !!args.characters?.length;
  const range = args.pacing === "energetic" ? "1.5-4" : args.pacing === "cinematic" ? "5-10" : "3-8";
  const sf = args.wholeClips ? null : (args.shotSeconds ?? null); // whole-clip modes keep the provider's clip length
  const sfAvg = sf ? (sf.min + sf.max) / 2 : 0;
  const orientation = args.aspectRatio === "R9_16" ? "portrait/vertical" : args.aspectRatio === "R16_9" ? "landscape" : "square-friendly";

  const system = story
    ? `You are the storyboard artist of an illustrated ${args.storyStyle?.includes("photo") ? "video" : "animated"} production with recurring characters. Every shot is an AI-generated image; describe exactly what is drawn. Respond with JSON only.`
    : `You are a video editor and stock-footage researcher. For each narration scene you break it into visual SHOTS covered by free Pexels stock footage. Respond with JSON only.`;
  const characterBlock = story
    ? `\nCharacters (draw them consistently, always refer to them by name): ${args.characters!.map((c) => `${c.name}: ${c.description}`).join(" | ")}
Illustration style: ${args.storyStyle}. Each shot: "characters": [names visible in the shot] (empty if none). Make "visualDescription" a complete illustration brief: setting, characters by name with their pose and expression, camera angle, mood, lighting. 2-3 shots per scene, 5-10 seconds each.`
    : "";
  const user = `Video: ${args.title} — chapter "${args.chapterTitle}". Tone: ${args.tone}. Orientation: ${orientation}.
${args.noVoice ? "There is NO narration in the final video: shot durations ARE the final timing, so make them deliberate (cinematic, music-driven), and the sum per scene is the scene's length. " : ""}${sf
  ? `FAST-CUT PACING — this is a short-form video and pacing IS the format: every shot lasts ${sf.min}-${sf.max} seconds and NEVER more than ${sf.max}. Number of shots for a scene = round(its word count ÷ ${wps.toFixed(1)} ÷ ${sfAvg.toFixed(1)}), minimum 2 — so a 40-second video needs roughly ${Math.round(40 / sfAvg)} shots in total. Short scenes still get at least 2 shots. Never show the same subject in two consecutive shots.`
  : args.wholeClips && args.maxShotSeconds
  ? `CLIP PLANNING: every shot becomes ONE generated video clip of exactly ${args.maxShotSeconds} seconds. Set every shot's "duration" to ${args.maxShotSeconds}. Number of shots per scene = round(word count ÷ ${wps.toFixed(1)} ÷ ${args.maxShotSeconds}), minimum 1. Each visualDescription must describe MOTION (what moves, camera move) since it is a video clip.`
  : `Pacing: change visuals every ${args.maxShotSeconds ? `4-${args.maxShotSeconds}` : range} seconds${args.maxShotSeconds ? ` (hard maximum ${args.maxShotSeconds} seconds per shot)` : ""}.`} Narration speed ≈ ${wps.toFixed(1)} words/second, so a scene's shot durations should add up to (word count ÷ ${wps.toFixed(1)}) seconds.

Scenes:
${args.scenes.map((s, i) => `[${i}] (${s.split(/\s+/).length} words) ${s}`).join("\n")}

For every scene return several shots. Each shot:
- "duration": seconds (number)
- "visualDescription": what the viewer sees, concrete and filmable. NEVER name a real person (living or dead) in it — describe them by appearance, age and clothing instead ("a thin young American with long hair", never "Steve Jobs"). Never describe anyone as a child; use "young adult" wording. Video generators refuse shots that break either rule.
- "pexelsVideoQueries": 2-4 SHORT stock-footage queries (1-3 words each, e.g. "warehouse robot", "online shopping", "city traffic"). Never long sentences. Prefer literal, generic, visually clear subjects that stock libraries actually have.
- "pexelsImageQueries": 1-3 short photo queries as fallback
- "transition": one of cut, dissolve, fade, dip_to_black, zoom, blur, slide (mostly "cut", occasionally "dissolve"; "fade" only at chapter start/end)
- "motion": one of none, zoom_in, zoom_out, pan_left, pan_right, ken_burns (used if a still image is chosen)
- NEVER use emojis or special symbols anywhere (they cannot be rendered).
- "onScreenText": ${preset?.textInImage ? `the label to DRAW INSIDE the illustration in the "${preset.name}" style (e.g. "BELOW 35°C", "2X", "NOW OPEN") — 1-4 words, use it on most shots because this style relies on hand-written labels` : "short text overlay (max 6 words) or \"\" — use sparingly for key numbers/terms"}${preset ? `\nVisual style for every shot: ${preset.name} — ${preset.description}. Describe each shot as it would look in that style (e.g. stick figures for whiteboard, chalk lines for chalkboard).` : ""}
- "characters": [] (names of characters in the shot; only in stories)${args.nativeSpeech ? `
- "dialogue": REQUIRED — the exact line(s) spoken in this clip as "Speaker: text". Each clip is ${args.maxShotSeconds ?? 8} seconds and speech must FINISH inside it, so at most ${Math.max(6, Math.floor((args.maxShotSeconds ?? 8) * wps * 0.7))} words per clip in ${args.language ?? "this language"} (use MORE clips rather than longer lines). Distribute ALL of the scene's lines across its shots in order, splitting a long line across two clips if needed; never drop or paraphrase words. The speaking character must be visible, facing camera, medium close-up.` : ""}
${args.nativeSpeech ? `\nSCENE LINES (verbatim, assign them to shots): ${JSON.stringify(args.nativeSpeech.lines)}` : ""}${characterBlock}${args.presenterMode ? `
PRESENTER AD: the presenter character appears in most shots, facing the camera, medium close-up, premium clean setting, natural talking gestures, product/service visuals cut in between. Keep the top ~10% and bottom ~10% of the frame free of important content (banner areas).` : ""}
${sf ? `
EVERY "visualDescription" must be one specific, filmable line: SUBJECT + what it is DOING + framing or camera move + light or time of day + setting. 8-20 words. Too vague: "person working on laptop", "city view", "team meeting". Good: "close-up of hands typing fast on a laptop, warm desk lamp, dark home office at night, slow push in"; "low-angle shot of a commuter train rushing past, cold morning light, empty platform". Each shot must show a different subject, location or angle than the one before it.` : ""}
Avoid repeating the same query across shots; vary the visuals.
Return: { "musicMood": "short mood description for this chapter's background music", "scenes": [ { "index": 0, "shots": [ ... ] } ] }`;

  return askValidated(ChapterShotsSchema, system, user, sf ? 12000 : 8000);
}

// ---------------------------------------------------------------------------
// 4. Music prompt
// ---------------------------------------------------------------------------

const MusicPromptSchema = z.object({ prompt: z.string().min(10) });

export async function createMusicPrompt(args: { title: string; tone: string; audience: string; minutes: number; moods: string[]; style?: string }): Promise<string> {
  const system = `You write prompts for an AI background-music generator. Respond with JSON only.`;
  const styleLine = args.style && args.style !== "Auto" && args.style !== "Custom" ? `Required musical style: ${args.style}.` : "";
  const user = `Video: "${args.title}". Tone: ${args.tone}. Audience: ${args.audience}. Length: ${args.minutes} minutes. ${styleLine}
Chapter moods: ${args.moods.filter(Boolean).join("; ") || "n/a"}.
Write ONE prompt (max 60 words) describing instrumental background music that sits underneath narration: genre, instruments, energy, no vocals.
Example: "Modern cinematic technology documentary instrumental, inspiring and sophisticated, soft electronic percussion, subtle piano and atmospheric synths, no vocals, suitable underneath narration."
Return: { "prompt": "..." }`;
  const out = await askValidated(MusicPromptSchema, system, user, 500);
  return out.prompt;
}

/** Cheap connectivity test used by the check-providers script. */
export async function pingDeepSeek(): Promise<string> {
  const raw = await chatJson([{ role: "user", content: 'Reply with JSON {"ok":true}' }], 20, 0);
  return raw.trim();
}

// ---------------------------------------------------------------------------
// Length correction: rewrite a chapter to an exact word count (used when the draft is off by >12%)
// ---------------------------------------------------------------------------

export async function rewriteToLength(args: { text: string; targetWords: number; language: string; keepEnding?: boolean }): Promise<string[]> {
  const system = `You edit spoken narration to an exact length without changing meaning, tone or language.${languageRule(args.language)} Never use bullet points, markdown or emojis. Respond with JSON only.`;
  const user = `Rewrite this ${args.language} narration to EXACTLY ${args.targetWords} words (±5%). ${args.text.split(/\s+/).length > args.targetWords ? "Cut filler, merge sentences, remove repeated ideas; keep the hook and the ending." : "Expand with concrete details and examples; keep the hook and the ending."}
Keep it split into scenes of 35-80 words, one idea each.
"""
${args.text}
"""
Return: { "scenes": [ { "narration": "..." } ] }`;
  const out = await askValidated(ChapterScriptSchema, system, user, 6000);
  return out.scenes.map((s) => s.narration.trim()).filter(Boolean);
}

export async function rewriteLinesToLength(args: { lines: Line[]; targetWords: number; language: string; names: string[]; narratorEnabled?: boolean }): Promise<Line[][]> {
  const have = args.lines.reduce((n, l) => n + l.text.split(/\s+/).filter(Boolean).length, 0);
  const speakers = args.narratorEnabled === false ? `one of: ${args.names.join(", ")} (no narrator)` : `"narrator" or one of: ${args.names.join(", ")}`;
  const expanding = args.targetWords > have * 1.08;
  // "Edit without changing the story" makes a model hand the same lines back when it should be ADDING —
  // so a short script gets an explicit writing brief: what to add, how much, and that nothing may be cut.
  const system = expanding
    ? `You are a screenplay writer extending a spoken script that has a narrator and character lines, in ${args.language}.${languageRule(args.language)} Respond with JSON only.`
    : `You edit a spoken script with a narrator and character lines to an exact length without changing the story, tone or language.${languageRule(args.language)} Respond with JSON only.`;
  const user = expanding
    ? `This script is ${have} words. It MUST become about ${args.targetWords} words — write roughly ${args.targetWords - have} NEW words. Keep every existing line (you may extend them) and ADD: more back-and-forth dialogue between the same characters (short lines, 5-14 words, reactions, questions, pauses), narrator lines that set the place, weather, sounds and small physical details, and one or two quiet moments that deepen the scene. Do not summarise, do not skip ahead, do not cut anything. Speakers must stay ${speakers}. Keep the hook and the ending. Split into scenes of 35-80 words. Write numbers as words.
${JSON.stringify(args.lines)}
Return: { "scenes": [ { "lines": [ { "speaker": "...", "text": "..." } ] } ] }`
    : `Rewrite to EXACTLY ${args.targetWords} words in total (±5%). Speakers must stay ${speakers}. Keep the hook and the ending. Split into scenes of 35-80 words.
${JSON.stringify(args.lines)}
Return: { "scenes": [ { "lines": [ { "speaker": "...", "text": "..." } ] } ] }`;
  const out = await askValidated(StoryChapterSchema, system, user, 6000);
  return out.scenes.map((s) => s.lines.map((l) => ({ speaker: args.names.includes(l.speaker) ? l.speaker : (args.narratorEnabled === false ? args.names[0] : "narrator"), text: l.text.trim() })).filter((l) => l.text));
}

/** Rewrites text that drifted into the wrong script (e.g. Hindi inside Punjabi) into the correct one, same meaning. */
export async function fixScript(args: { text: string; language: string }): Promise<string[]> {
  const system = `You are a professional ${args.language} editor.${languageRule(args.language)} Keep meaning, length and tone identical. Respond with JSON only.`;
  const user = `Some of this text is in the wrong language or script. Rewrite it entirely in ${args.language}. Keep it split into the same scenes.
"""
${args.text}
"""
Return: { "scenes": [ { "narration": "..." } ] }`;
  const out = await askValidated(ChapterScriptSchema, system, user, 6000);
  return out.scenes.map((s) => s.narration.trim()).filter(Boolean);
}
export async function fixScriptLines(args: { lines: Line[]; language: string; names: string[] }): Promise<Line[][]> {
  const system = `You are a professional ${args.language} editor.${languageRule(args.language)} Keep meaning, speakers, length and tone identical. Respond with JSON only.`;
  const user = `Some lines are in the wrong language or script. Rewrite every line entirely in ${args.language}. Speakers must stay exactly as given.
${JSON.stringify(args.lines)}
Return: { "scenes": [ { "lines": [ { "speaker": "...", "text": "..." } ] } ] }`;
  const out = await askValidated(StoryChapterSchema, system, user, 6000);
  return out.scenes.map((s) => s.lines.map((l) => ({ speaker: l.speaker, text: l.text.trim() })).filter((l) => l.text));
}

// ---------------------------------------------------------------------------
// Video ideas
// ---------------------------------------------------------------------------
const IdeasSchema = z.object({ ideas: z.array(z.object({
  title: z.string().min(4), topic: z.string().default(""), format: z.string().default("YouTube Video"), lengthSeconds: z.number().int().min(15).max(3600).default(480),
  potential: z.enum(["high", "medium", "low"]).default("medium"), competition: z.enum(["low", "medium", "high"]).default("medium"), why: z.string().default(""),
})).min(1) });

export async function generateIdeas(args: { topic: string; niche?: string; language: string; audience?: string; count: number; filter?: string }) {
  const types = VIDEO_TEMPLATES.map((t) => t.id).join(", ");
  const system = `You are a YouTube strategist who suggests video ideas with high click-and-watch potential. Respond with JSON only.`;
  const user = `Suggest ${args.count} video ideas${args.topic ? ` about: ${args.topic}` : ""}${args.niche ? ` for a channel in the niche: ${args.niche}` : ""}${args.audience ? ` for this audience: ${args.audience}` : ""}. Language of the titles: ${args.language}.
${args.filter === "shorts" ? "All ideas must be Shorts (15-60 seconds)." : args.filter === "long" ? "All ideas must be long-form (6-15 minutes)." : args.filter === "evergreen" ? "Prefer evergreen topics that stay relevant for years." : args.filter === "trending" ? "Prefer topics currently trending or seasonal." : args.filter === "lowcomp" ? "Prefer specific angles with low competition." : ""}
Each idea: a clickable title (max 70 chars), the topic, the best "format" from this list: ${types}, lengthSeconds, potential (high/medium/low), competition (low/medium/high), and one sentence "why" it fits the audience.
Return { "ideas": [ ... ] }`;
  const out = await askValidated(IdeasSchema, system, user, 4000);
  return out.ideas;
}

// ---------------------------------------------------------------------------
// Academy course outline
// ---------------------------------------------------------------------------
const CourseSchema = z.object({ lessons: z.array(z.object({ category: z.string().min(2), title: z.string().min(4), description: z.string().min(10), prompt: z.string().min(40), minutes: z.number().min(1).max(8).default(3) })).min(4) });

export async function generateCourseOutline(args: { topic: string; audience: string; lessons: number; language: string }) {
  const system = `You design short video courses for beginner YouTube creators. Each lesson becomes a 2-4 minute AI-narrated explainer with AI images. Respond with JSON only.`;
  const user = `Design a course "${args.topic}" for ${args.audience}, ${args.lessons} lessons, in ${args.language}. Group lessons under categories from: Getting Started, Video Creation, Thumbnails, YouTube SEO, Growth, Analytics, Monetization.
For every lesson give: category, a clear title (max 60 chars), a one-sentence description, "minutes" (2-4), and a production "prompt" for the video generator: what to cover, in what order, concrete examples, a practical tip, and a one-line summary — no earnings promises, tell viewers to check YouTube's current requirements where relevant.
Return { "lessons": [ ... ] } ordered as a learning path.`;
  return (await askValidated(CourseSchema, system, user, 6000)).lessons;
}
