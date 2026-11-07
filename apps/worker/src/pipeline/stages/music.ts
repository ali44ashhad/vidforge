import path from "node:path";
import { pickTrack } from "../../services/musicLibrary";
import { prisma } from "@vidforge/db";
import type { StageDefinition } from "../types";
import { submitMusic, waitForMusic } from "../../services/music";
import { downloadFile, probeDuration } from "../../lib/media";
import { projectDir, publicUrl } from "../../lib/storage";
import { bumpStats } from "../stats";
import { sleep } from "../../lib/log";

/**
 * MUSIC_GENERATION: one Kie track per project (multi-track per chapter comes later).
 * If Kie fails twice the project continues WITHOUT music instead of failing.
 */
/** In-flight background music jobs started early (during FETCHING_MEDIA) so music overlaps the visuals. */
export const musicInFlight = new Map<string, Promise<void>>();

export function startMusicEarly(ctx: Parameters<StageDefinition["run"]>[0]) {
  if (musicInFlight.has(ctx.project.id)) return;
  const quiet = { ...ctx, report: async () => {}, log: (m: string, extra?: unknown) => ctx.log(`(music, background) ${m}`, extra) };
  const job = musicGeneration.run(quiet).catch((e) => ctx.log(`background music failed: ${(e as Error).message}`)).finally(() => musicInFlight.delete(ctx.project.id));
  musicInFlight.set(ctx.project.id, job);
}

export const musicGeneration: StageDefinition = {
  name: "MUSIC_GENERATION",
  async run(ctx) {
    const p = ctx.project;
    const early = musicInFlight.get(p.id);
    if (early) { ctx.log("waiting for background music started during visuals"); await early; }
    if (!p.musicEnabled) { ctx.log("music disabled for this project"); await bumpStats(p.id, { musicTracks: 0 }); return; }
    const existing = await prisma.musicTrack.findFirst({ where: { projectId: p.id, status: "READY", NOT: { prompt: { startsWith: "[mood:" } } } });
    if (existing) { ctx.log("music already generated"); await generateMoodTracks(ctx); return; }

    // library first: instant, free, and immune to Kie outages (custom prompts still generate live)
    if (p.musicStyle !== "Custom" && process.env.MUSIC_LIBRARY !== "off") {
      const t = await pickTrack(p.musicStyle, Math.min(60, p.targetDuration * 0.5));
      if (t) {
        await prisma.musicTrack.create({ data: { projectId: p.id, provider: "library", prompt: t.prompt, status: "READY", audioUrl: t.audioUrl, localPath: t.localPath, duration: t.duration, generationId: `library:${t.id}` } });
        await bumpStats(p.id, { musicTracks: 1, musicSource: "library" });
        ctx.log(`music from library: ${t.style} · ${t.mood ?? ""} (${t.duration.toFixed(0)}s)`);
        return;
      }
      ctx.log("music library has no track for this style yet — generating live");
    }
    const prompt = (p.musicStyle === "Custom" && p.musicCustomPrompt?.trim())
      ? p.musicCustomPrompt.trim()
      : p.musicPrompt || `Cinematic instrumental background music for a ${p.videoType}, no vocals, suitable underneath narration.`;
    const dir = projectDir(p.id, "music");

    // Kie's backend sometimes returns "Internal Error"; retry with waits, then a different model, then a simpler prompt.
    const plan = [
      { model: process.env.KIE_MODEL || "V4_5", prompt, wait: 0 },
      { model: process.env.KIE_MODEL || "V4_5", prompt, wait: 60_000 },
      { model: process.env.KIE_MUSIC_FALLBACK_MODEL || "V4", prompt, wait: 30_000 },
      { model: process.env.KIE_MUSIC_FALLBACK_MODEL || "V4", prompt: `Calm instrumental background music, ${p.musicStyle !== "Auto" && p.musicStyle !== "Custom" ? p.musicStyle.toLowerCase() : "cinematic"}, no vocals.`, wait: 60_000 },
    ];
    for (let attempt = 1; attempt <= plan.length; attempt++) {
      const step = plan[attempt - 1];
      if (step.wait) { ctx.log(`waiting ${step.wait / 1000}s before music attempt ${attempt}`); await sleep(step.wait); }
      const track = await prisma.musicTrack.create({ data: { projectId: p.id, provider: "kie", prompt: step.prompt, status: "PENDING" } });
      try {
        const taskId = await submitMusic(step.prompt, step.model);
        await prisma.musicTrack.update({ where: { id: track.id }, data: { generationId: taskId, status: "GENERATING" } });
        ctx.log(`kie task ${taskId} submitted (attempt ${attempt})`);
        let ticks = 0;
        const result = await waitForMusic(taskId, 8 * 60 * 1000, () => { ticks++; void ctx.report(Math.min(85, ticks * 5), "generating"); });
        const dest = path.join(dir, `track-${track.id}.mp3`);
        await downloadFile(result.audioUrl, dest);
        const duration = await probeDuration(dest);
        await prisma.musicTrack.update({
          where: { id: track.id },
          data: { audioUrl: publicUrl(dest), localPath: dest, duration, status: "READY", generationId: `${taskId}:${result.id}` },
        });
        await bumpStats(p.id, { musicTracks: 1 });
        ctx.log(`music ready: ${duration.toFixed(0)}s`);
        await generateMoodTracks(ctx);
        return;
      } catch (e) {
        const msg = (e as Error).message;
        await prisma.musicTrack.update({ where: { id: track.id }, data: { status: "FAILED" } });
        ctx.log(`music attempt ${attempt}/${plan.length} (${step.model}) failed: ${msg}`);
        if (/credits? insufficient|insufficient (credits|balance)|top up/i.test(msg)) { ctx.log("Kie balance is empty — skipping the remaining retries; top up at kie.ai"); await bumpStats(p.id, { musicProviderError: "kie: credits insufficient" }); break; }
      }
    }
    await bumpStats(p.id, { musicTracks: 0, musicWarning: "Background music could not be generated; video continues without music." });
    ctx.log("continuing without music");
  },
};


/**
 * MUSIC THAT FOLLOWS THE STORY. Chapters can carry a mood ("[दृश्य: title | tense]" in a screenplay). For a Custom
 * music prompt, one extra track is generated per distinct mood, tagged "[mood:<m>]" in its prompt; the render then
 * builds the music bed chapter by chapter, crossfading between tracks. Base track stays the fallback for untagged chapters.
 */
const MOOD_HINT: Record<string, string> = {
  tense: "mood: tense and dark — faster low pulse, tremolo strings, rising pressure, still no melody",
  calm: "mood: calm and spacious — slower, softer, lighter pulse, gentle, almost still",
  emotional: "mood: emotional and restrained — slow, a single sustained cello line, warm but sad",
  uplifting: "mood: hopeful and rising — brighter, steady pulse, gently building",
};
async function generateMoodTracks(ctx: Parameters<StageDefinition["run"]>[0]) {
  const p = ctx.project;
  if (p.musicStyle !== "Custom" || !p.musicCustomPrompt?.trim() || process.env.MOOD_MUSIC === "off") return;
  const chapters = await prisma.chapter.findMany({ where: { projectId: p.id }, select: { musicMood: true } });
  const moods = [...new Set(chapters.map((c) => c.musicMood).filter((m): m is string => !!m && !!MOOD_HINT[m]))].slice(0, 4);
  if (!moods.length) return;
  const have = await prisma.musicTrack.findMany({ where: { projectId: p.id, status: "READY", prompt: { startsWith: "[mood:" } }, select: { prompt: true } });
  const done = new Set(have.map((t) => t.prompt.match(/^\[mood:(\w+)\]/)?.[1]));
  const dir = projectDir(p.id, "music");
  for (const mood of moods) {
    if (done.has(mood)) continue;
    const prompt = `[mood:${mood}] ${p.musicCustomPrompt.trim()} — ${MOOD_HINT[mood]}`;
    const track = await prisma.musicTrack.create({ data: { projectId: p.id, provider: "kie", prompt, status: "PENDING" } });
    try {
      const taskId = await submitMusic(prompt, process.env.KIE_MODEL || "V4_5");
      await prisma.musicTrack.update({ where: { id: track.id }, data: { generationId: taskId, status: "GENERATING" } });
      ctx.log(`mood music "${mood}": kie task ${taskId}`);
      const result = await waitForMusic(taskId, 8 * 60 * 1000, () => {});
      const dest = path.join(dir, `track-${track.id}.mp3`);
      await downloadFile(result.audioUrl, dest);
      const duration = await probeDuration(dest);
      await prisma.musicTrack.update({ where: { id: track.id }, data: { audioUrl: publicUrl(dest), localPath: dest, duration, status: "READY", generationId: `${taskId}:${result.id}` } });
      ctx.log(`mood music "${mood}" ready: ${duration.toFixed(0)}s`);
    } catch (e) {
      await prisma.musicTrack.update({ where: { id: track.id }, data: { status: "FAILED" } });
      ctx.log(`mood music "${mood}" failed: ${(e as Error).message.slice(0, 120)} — base track covers those chapters`);
    }
  }
}
