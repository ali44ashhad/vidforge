import path from "node:path";
import { aiPickVoice } from "../../services/voice/aiPick";
import { voiceDefaultFor } from "../../services/config";
import { prisma, type Prisma } from "@vidforge/db";
import type { StageDefinition } from "../types";
import { resolveVoiceId, synthesizeToFile, alignmentToWords, estimateWords, providerName, normalizeForSpeech, languageVoiceScore } from "../../services/voice";
import { mapLimit } from "../../lib/http";
import { probeDuration, assertFfmpegInstalled } from "../../lib/media";
import { projectDir, publicUrl } from "../../lib/storage";
import { runFfmpeg } from "../../lib/ffmpeg";
import fs from "node:fs";
import type { Line } from "@vidforge/shared";
import { recalculateTimeline, fitShotsToClips, mergeScenesPerChapter, splitLongShots } from "../timing";
import { shotSecondsFor } from "@vidforge/shared";
import { bumpStats } from "../stats";

/** VOICE_GENERATION: one ElevenLabs segment per scene, real durations via ffprobe, then timeline recalculation. */
export const voiceGeneration: StageDefinition = {
  name: "VOICE_GENERATION",
  async run(ctx) {
    let p = ctx.project;
    // Native speech gives every 8-second clip its own invented voice → a character sounds different in every clip.
    // Only allow it when the whole video fits in one clip per speaker; otherwise fall back to TTS (consistent voices).
    if (p.speechMode === "veo_native" && p.targetDuration > 8 * Math.max(1, (await prisma.projectCharacter.count({ where: { projectId: p.id } })))) {
      ctx.log("native speech would produce a different voice per clip for this length — using TTS for consistent character voices");
      await prisma.project.update({ where: { id: p.id }, data: { speechMode: "tts" } });
      p = { ...p, speechMode: "tts" };
    }
    if (p.speechMode === "veo_native") {
      // Veo speaks the lines; every shot is one fixed-length clip. Timing comes from the shots.
      await prisma.project.update({ where: { id: p.id }, data: { voiceEnabled: false } });
      const total = await recalculateTimeline(p.id);
      await bumpStats(p.id, { voiceSegments: 0, durationSeconds: Math.round(total), captionTiming: "native speech (Veo)" });
      ctx.log(`native speech mode — no TTS; ${total.toFixed(1)}s from ${await prisma.shot.count({ where: { scene: { chapter: { projectId: p.id } } } })} clips`);
      await ctx.report(100);
      return;
    }
    if (!p.voiceEnabled) {
      let total = await recalculateTimeline(p.id);
      // the storyboard's planned durations are a guess — scale them so the video is the length the user asked for
      if (total > 0 && Math.abs(total - p.targetDuration) / p.targetDuration > 0.1) {
        const k = p.targetDuration / total;
        const shots = await prisma.shot.findMany({ where: { scene: { chapter: { projectId: p.id } } }, select: { id: true, duration: true } });
        await Promise.all(shots.map((s) => prisma.shot.update({ where: { id: s.id }, data: { duration: Math.max(1.5, s.duration * k) } })));
        total = await recalculateTimeline(p.id);
        ctx.log(`no-voice timeline scaled ×${k.toFixed(2)} to match the requested ${p.targetDuration}s → ${total.toFixed(1)}s`);
      }
      if (/ai_video/.test(p.visualSource)) { await mergeScenesPerChapter(p.id); await recalculateTimeline(p.id); const fit = await fitShotsToClips(p.id, /omni/.test(process.env.SNAPGEN_VIDEO_MODEL || "") ? 10 : 8); await bumpStats(p.id, { shots: fit.shots }); }
      await applyShortFormPacing(p, ctx.log);
      await bumpStats(p.id, { voiceSegments: 0, durationSeconds: Math.round(total), captionTiming: "no voiceover" });
      ctx.log(`voiceover disabled — timeline from storyboard: ${total.toFixed(1)}s`);
      await ctx.report(100);
      return;
    }
    await assertFfmpegInstalled();

    const scenes = await prisma.scene.findMany({
      where: { chapter: { projectId: p.id } },
      orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
      include: { voiceSegment: true },
    });
    if (!scenes.length) throw new Error("No scenes found");

    const narratorStyle = p.videoType === "Kids Story" ? "Storytelling" : p.voiceStyle;
    // narrator: explicit choice → template/brand default → AI casting from the community library → standard pool
    const preset = p.voiceId || (await voiceDefaultFor(p.language));
    const aiNarrator = preset ? null : await aiPickVoice({ projectId: p.id, language: p.language, videoType: p.videoType, topic: p.title || p.prompt, voiceStyle: narratorStyle });
    const voiceId = await resolveVoiceId(narratorStyle, preset || aiNarrator || "", p.language, prisma as never);
    if (p.voiceId !== voiceId) await prisma.project.update({ where: { id: p.id }, data: { voiceId } });
    ctx.log(`voice ${voiceId} via ${providerName()}, ${scenes.length} segments`);

    // Story mode: one voice per character (assigned from the synced voice list by the character's voiceHint)
    const charVoice = new Map<string, string>();
    if (p.storyMode && p.characterVoices) {
      const pcs = await prisma.projectCharacter.findMany({ where: { projectId: p.id }, include: { character: true }, orderBy: { order: "asc" } });
      const pool = await prisma.voice.findMany();
      LANG_FOR_PICK = p.language;
      const taken = new Set<string>([voiceId]);
      for (const { character: c } of pcs) {
        let id = c.voiceId && pool.some((v) => v.id === c.voiceId) ? c.voiceId : null;
        if (!id) id = await aiPickVoice({ projectId: p.id, language: p.language, videoType: p.videoType, topic: p.title || p.prompt, voiceStyle: narratorStyle, gender: c.gender, age: c.ageGroup, persona: `${c.name}, ${c.personality || c.description || ""}`.slice(0, 200), exclude: taken });
        if (id && !pool.some((v) => v.id === id)) pool.push(await prisma.voice.findUniqueOrThrow({ where: { id } }));
        if (!id) {
          // hard gender filter when the character's gender is known
          const g = (c.gender || "").toLowerCase();
          const genderPool = g ? pool.filter((v) => voiceGender(v) === g) : pool;
          const hint = [c.gender, c.ageGroup, c.ethnicity, c.voiceHint || c.description].filter(Boolean).join(", ");
          id = pickVoiceForHint(hint, genderPool.length ? genderPool : pool, taken);
          if (g && !genderPool.length) ctx.log(`warning: no ${g} voices in the synced voice list — pick one manually on the character`);
        }
        if (id) { charVoice.set(c.name, id); taken.add(id); if (id !== c.voiceId) await prisma.character.update({ where: { id: c.id }, data: { voiceId: id } }); }
      }
      ctx.log(`character voices: ${[...charVoice.entries()].map(([n, v]) => `${n}→${pool.find((x) => x.id === v)?.name ?? v}`).join(", ") || "none (voice list empty)"}`);
    }

    const dir = projectDir(p.id, "voice");
    let done = 0;

    await mapLimit(scenes, Number(process.env.VOICE_CONCURRENCY || 6), async (scene, i) => {
      if (scene.voiceSegment) { done++; return; } // resume support
      const dest = path.join(dir, `scene-${String(i).padStart(3, "0")}.mp3`);
      // plausibility window: narration runs ~10-20 characters/second; anything far outside means a bad file
      const chars = scene.narration.replace(/\s+/g, " ").length;
      const minExpected = Math.max(0.8, chars / 35), maxExpected = chars / 5 + 5;
      let alignment: Awaited<ReturnType<typeof synthesizeToFile>>["alignment"] = null;
      let duration = 0;
      let storyWords: { word: string; start: number; end: number }[] | null = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        const rawLines = (scene.lines as Line[] | null) ?? null;
        const firstChar = [...charVoice.keys()][0];
        const lines = rawLines?.map((l) => ({ ...l, speaker: !p.narratorEnabled && l.speaker === "narrator" && firstChar ? firstChar : l.speaker, text: normalizeForSpeech(l.text, p.language) })) ?? null;
        if (p.storyMode && lines?.length && charVoice.size) {
          storyWords = await synthesizeLines(lines, i, dest, dir, { narrator: voiceId, chars: charVoice, style: narratorStyle, speed: p.voiceSpeed, language: p.language });
          alignment = null;
        } else {
          const text = normalizeForSpeech(lines?.length ? lines.map((l) => l.text).join(" ") : scene.narration, p.language); // narrator reads dialogue too
          ({ alignment } = await synthesizeToFile({
            text, voiceId, style: narratorStyle, speed: p.voiceSpeed, dest, language: p.language,
            previousText: scenes[i - 1]?.narration, nextText: scenes[i + 1]?.narration,
          }));
        }
        duration = await probeDuration(dest).catch(() => 0);
        if (duration >= minExpected && duration <= maxExpected) break;
        ctx.log(`segment ${i}: got ${duration.toFixed(1)}s for ${chars} chars (expected ${minExpected.toFixed(1)}-${maxExpected.toFixed(1)}s) — retry ${attempt}/3`);
        if (attempt === 3) throw new Error(`Voice segment ${i} keeps coming back with an implausible length (${duration.toFixed(1)}s for ${chars} characters)`);
      }
      const spoken = normalizeForSpeech((scene.lines as Line[] | null)?.map((l) => l.text).join(" ") || scene.narration, p.language);
      const words = storyWords ?? (alignment ? alignmentToWords(alignment) : estimateWords(spoken, duration));
      await prisma.voiceSegment.create({
        data: {
          projectId: p.id, sceneId: scene.id, order: i, provider: providerName(), voiceId, text: scene.narration,
          audioUrl: publicUrl(dest), localPath: dest, duration, alignment: words as unknown as Prisma.InputJsonValue,
        },
      });
      done++;
      await ctx.report(Math.round((done / scenes.length) * 90), `${done}/${scenes.length}`);
    });

    let total = await recalculateTimeline(p.id);
    if (/ai_video/.test(p.visualSource)) {
      const clipLen = /omni/.test(process.env.SNAPGEN_VIDEO_MODEL || "") ? 10 : 8;
      // Merging a chapter into one scene spreads its clips evenly over the whole chapter, so a line spoken
      // at 0:40 may sit under a clip planned for 1:10 — the "visuals run ahead of the voice" effect. Dialogue
      // films keep one scene per line group so every clip stays with the lines it was planned for.
      const keepScenes = (p.storyMode && p.characterVoices) || process.env.MERGE_SCENES === "off";
      const m = keepScenes ? { merged: 0 } : await mergeScenesPerChapter(p.id);
      if (m.merged) { total = await recalculateTimeline(p.id); ctx.log(`merged scenes in ${m.merged} chapter(s) so clip rounding happens once per chapter`); }
      else if (keepScenes) ctx.log("scenes kept separate so clips stay aligned with their lines");
      const fit = await fitShotsToClips(p.id, clipLen);
      await bumpStats(p.id, { shots: fit.shots });
      ctx.log(`clip fitting: ${fit.shots} clips of ≤${clipLen}s across ${fit.scenes} scenes (real narration ${total.toFixed(0)}s)`);
    }
    await applyShortFormPacing(p, ctx.log);
    await bumpStats(p.id, { voiceSegments: scenes.length, durationSeconds: Math.round(total), captionTiming: providerName() === "elevenlabs" ? "word-accurate" : "estimated" });
    ctx.log(`voice done: ${scenes.length} segments, total ${total.toFixed(1)}s`);
  },
};

/** Picks a voice whose labels match the hint (gender/age words), avoiding voices already in use. */
let LANG_FOR_PICK = "English";
function pickVoiceForHint(hint: string, pool: { id: string; name: string; labels: unknown }[], taken: Set<string>): string | null {
  const h = hint.toLowerCase();
  const want = {
    female: /\b(girl|woman|female|she|her|mother|mom|queen|princess|grandma|lady|sister|aunt)\b/.test(h),
    male: /\b(boy|man|male|he|his|father|dad|king|prince|grandpa|sir|brother|uncle)\b/.test(h),
    young: /\b(child|kid|young|little|boy|girl|baby|small)\b/.test(h),
    old: /\b(old|elder|grand|wise|ancient)\b/.test(h),
  };
  let best: { id: string; score: number } | null = null;
  for (const v of pool) {
    if (taken.has(v.id)) continue;
    const l = Object.values((v.labels as Record<string, string>) ?? {}).join(" ").toLowerCase() + " " + v.name.toLowerCase();
    let s = 0;
    if (want.female && /female|woman|girl/.test(l)) s += 5;
    if (want.male && /\bmale\b|\bman\b|boy/.test(l)) s += 5;
    if (want.young && /young|child|kid|teen/.test(l)) s += 3;
    if (want.old && /old|elder|mature|middle/.test(l)) s += 3;
    if (/narrat|story|audiobook|animation|character|playful|warm|friendly/.test(l)) s += 1;
    s += languageVoiceScore(LANG_FOR_PICK, v.labels as Record<string, string>, v.name);
    if (!best || s > best.score) best = { id: v.id, score: s };
  }
  return best?.id ?? null;
}

/**
 * Synthesizes narrator + character lines separately, joins them with short gaps into one MP3,
 * and returns word timings offset into the combined file (estimated when the provider gives none).
 */
async function synthesizeLines(lines: Line[], sceneIndex: number, dest: string, dir: string,
  v: { narrator: string; chars: Map<string, string>; style: string; speed: number; language: string }) {
  const GAP = 0.25;
  const partsDir = path.join(dir, `parts-${String(sceneIndex).padStart(3, "0")}`);
  fs.mkdirSync(partsDir, { recursive: true });
  const words: { word: string; start: number; end: number }[] = [];
  const files: string[] = [];
  let t = 0;
  for (let k = 0; k < lines.length; k++) {
    const line = lines[k];
    const vid = line.speaker === "narrator" ? v.narrator : (v.chars.get(line.speaker) ?? v.narrator);
    const file = path.join(partsDir, `${k}.mp3`);
    const { alignment } = await synthesizeToFile({
      text: line.text, voiceId: vid, style: line.speaker === "narrator" ? v.style : "Conversational", speed: v.speed, dest: file,
      previousText: lines[k - 1]?.text, nextText: lines[k + 1]?.text, language: v.language,
    });
    const d = await probeDuration(file);
    const w = alignment ? alignmentToWords(alignment) : estimateWords(line.text, d);
    for (const x of w) words.push({ word: x.word, start: t + x.start, end: t + x.end });
    files.push(file);
    t += d + GAP;
  }
  // join with silence gaps: [0][gap][1][gap]... using concat filter
  const inputs = files.flatMap((f) => ["-i", f]);
  const chain = files.map((_, i) => `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono,apad=pad_dur=${GAP}[a${i}]`);
  chain.push(`${files.map((_, i) => `[a${i}]`).join("")}concat=n=${files.length}:v=0:a=1[out]`);
  await runFfmpeg([...inputs, "-filter_complex", chain.join(";"), "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", dest]);
  return words;
}

function voiceGender(v: { name: string; labels: unknown }): "female" | "male" | "" {
  const l = Object.values((v.labels as Record<string, string>) ?? {}).join(" ").toLowerCase() + " " + v.name.toLowerCase();
  if (/\bfemale\b|\bwoman\b|\bgirl\b/.test(l)) return "female";
  if (/\bmale\b|\bman\b|\bboy\b/.test(l)) return "male";
  return "";
}

/**
 * Short-form pacing: once the narration has fixed the timeline, cut any shot longer than the format's maximum into
 * several shots, so a 30-45 s video really does change picture every 1.5-3 seconds. Long-form and AI-video modes are
 * untouched (shotSecondsFor returns null for them).
 */
async function applyShortFormPacing(p: { id: string; videoType: string; targetDuration: number; visualSource: string }, log: (m: string) => void) {
  const sf = shotSecondsFor(p.videoType, p.targetDuration, p.visualSource);
  if (!sf) return;
  const r = await splitLongShots(p.id, sf.max, Math.min(sf.min, 1.4));
  await bumpStats(p.id, { shots: r.shots });
  log(`short-form pacing: ${r.shots} shots of <=${sf.max}s${r.added ? ` (${r.added} extra cut(s) added)` : ""}`);
}
