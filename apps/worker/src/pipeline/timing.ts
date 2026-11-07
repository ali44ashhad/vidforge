import path from "node:path";
import fs from "node:fs";
import { prisma, type Prisma } from "@vidforge/db";
import { runFfmpeg } from "../lib/ffmpeg";
import { probeDuration } from "../lib/media";
import { projectDir, publicUrl } from "../lib/storage";

/** Silence added between narration segments so scenes breathe (seconds). */
export const SCENE_PAUSE = 0.35;
const MIN_SHOT = 1.5;

/**
 * Timing engine: uses REAL voice durations to set scene/chapter timestamps and
 * rescales planned shot durations so shots exactly cover each scene's narration.
 * Returns the total video duration in seconds.
 */
export async function recalculateTimeline(projectId: string): Promise<number> {
  const project = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { voiceEnabled: true } });
  const chapters = await prisma.chapter.findMany({
    where: { projectId }, orderBy: { order: "asc" },
    include: { scenes: { orderBy: { order: "asc" }, include: { voiceSegment: true, shots: { orderBy: { order: "asc" } } } } },
  });

  let t = 0;
  for (const ch of chapters) {
    const chStart = t;
    for (const scene of ch.scenes) {
      const voice = scene.voiceSegment;
      if (project.voiceEnabled && !voice) throw new Error(`Scene ${scene.id} has no voice segment`);
      // with voiceover: real audio length + pause; without: the storyboard's planned shot durations
      const sceneLen = project.voiceEnabled && voice
        ? voice.duration + SCENE_PAUSE
        : Math.max(2, scene.shots.reduce((a, s) => a + Math.max(0.5, s.duration), 0));
      const sceneStart = t;

      // rescale shots to fill sceneLen
      let shots = scene.shots;
      const planned = shots.reduce((a, s) => a + Math.max(0.5, s.duration), 0) || 1;
      let durations = shots.map((s) => (Math.max(0.5, s.duration) / planned) * sceneLen);
      // drop shots that would be too short, then rescale again
      while (durations.length > 1 && Math.min(...durations) < MIN_SHOT) {
        const idx = durations.indexOf(Math.min(...durations));
        shots = shots.filter((_, i) => i !== idx);
        durations = durations.filter((_, i) => i !== idx);
        const sum = durations.reduce((a, b) => a + b, 0);
        durations = durations.map((d) => (d / sum) * sceneLen);
      }
      // remove dropped shots from DB
      const keep = new Set(shots.map((s) => s.id));
      const dropped = scene.shots.filter((s) => !keep.has(s.id)).map((s) => s.id);
      if (dropped.length) await prisma.shot.deleteMany({ where: { id: { in: dropped } } });

      let st = sceneStart;
      for (let i = 0; i < shots.length; i++) {
        const d = durations[i];
        await prisma.shot.update({ where: { id: shots[i].id }, data: { order: i, startTime: st, endTime: st + d, duration: d } });
        st += d;
      }
      await prisma.scene.update({ where: { id: scene.id }, data: { startTime: sceneStart, endTime: sceneStart + sceneLen } });
      t = sceneStart + sceneLen;
    }
    await prisma.chapter.update({ where: { id: ch.id }, data: { startTime: chStart, endTime: t } });
  }
  await prisma.project.update({ where: { id: projectId }, data: { actualDuration: t } });
  return t;
}

/**
 * Short-form pacing, enforced after the narration has fixed the timeline: no shot may sit on screen longer than
 * maxSeconds. A long shot is cut into equal parts — the original keeps the first part and clones take the rest, with
 * the same brief marked "different angle", so the media stage fetches a DIFFERENT clip or image for each one (used
 * asset IDs are never reused inside a project). Scene and video lengths do not change, only the number of cuts.
 */
export async function splitLongShots(projectId: string, maxSeconds: number, minSeconds = 1.4): Promise<{ added: number; shots: number }> {
  const scenes = await prisma.scene.findMany({
    where: { chapter: { projectId } }, orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
    include: { shots: { orderBy: { order: "asc" } } },
  });
  let added = 0, total = 0;
  for (const sc of scenes) {
    if (!sc.shots.length) continue;
    if (!sc.shots.some((sh) => sh.duration > maxSeconds + 0.05)) { total += sc.shots.length; continue; }
    // free the order range first — [sceneId, order] is unique, so renumbering in place would collide
    await prisma.shot.updateMany({ where: { sceneId: sc.id }, data: { order: { increment: 1000 } } });
    let t = sc.startTime ?? 0, order = 0;
    for (const sh of sc.shots) {
      let n = Math.max(1, Math.ceil((sh.duration - 0.05) / maxSeconds));
      while (n > 1 && sh.duration / n < minSeconds) n--;
      const each = sh.duration / n;
      await prisma.shot.update({ where: { id: sh.id }, data: { order: order++, duration: each, startTime: t, endTime: t + each } });
      t += each;
      for (let k = 1; k < n; k++) {
        await prisma.shot.create({ data: {
          sceneId: sc.id, order: order++, duration: each, startTime: t, endTime: t + each,
          visualDescription: `${sh.visualDescription} — different angle (cut ${k + 1})`,
          videoQueries: sh.videoQueries, imageQueries: sh.imageQueries, onScreenText: null,
          transition: "cut", motion: sh.motion, characterNames: sh.characterNames,
        } });
        t += each; added++;
      }
      total += n;
    }
  }
  return { added, shots: total };
}

/**
 * AI-video modes: make every scene use whole clips. With the REAL scene length known, the number of
 * shots becomes ceil(sceneLen / clipLen) and each shot gets sceneLen / n seconds (≤ clipLen, so no looping).
 * Extra shots are dropped (their media, if any, is detached); missing shots are cloned from the last one.
 */
export async function fitShotsToClips(projectId: string, clipLen: number): Promise<{ scenes: number; shots: number }> {
  const scenes = await prisma.scene.findMany({
    where: { chapter: { projectId } }, orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }],
    include: { shots: { orderBy: { order: "asc" } } },
  });
  // clip budget: the requested length (+20%) divided by the clip length — extra clips cost credits and time and make the video run long
  const proj = await prisma.project.findUniqueOrThrow({ where: { id: projectId }, select: { targetDuration: true, voiceEnabled: true, speechMode: true } });
  const clipsDefineLength = !proj.voiceEnabled || proj.speechMode === "veo_native"; // with TTS the voice length already bounds the video
  const maxClips = clipsDefineLength ? Math.max(1, Math.ceil((proj.targetDuration * 1.2) / clipLen)) : Number.POSITIVE_INFINITY;
  let used = 0, shift = 0; // shift = seconds removed so far (later scenes move earlier)
  let total = 0;
  for (const sc of scenes) {
    const len = (sc.endTime ?? 0) - (sc.startTime ?? 0);
    if (len <= 0) continue;
    let n = Math.max(1, Math.ceil((len - 0.05) / clipLen));
    const wanted = n;
    if (used + n > maxClips) n = Math.max(1, maxClips - used);
    used += n;
    const each = n < wanted ? clipLen : len / n;
    const newLen = each * n;
    if (shift || newLen !== len) {
      await prisma.scene.update({ where: { id: sc.id }, data: { startTime: (sc.startTime ?? 0) - shift, endTime: (sc.startTime ?? 0) - shift + newLen } });
      sc.startTime = (sc.startTime ?? 0) - shift; shift += len - newLen;
    }
    let shots = sc.shots;
    if (shots.length > n) {
      await prisma.shot.deleteMany({ where: { id: { in: shots.slice(n).map((s) => s.id) } } });
      shots = shots.slice(0, n);
    }
    while (shots.length < n) {
      const src = shots[shots.length - 1];
      const clone = await prisma.shot.create({ data: {
        sceneId: sc.id, order: shots.length, duration: each, visualDescription: `${src.visualDescription} (continued, different angle)`,
        videoQueries: src.videoQueries, imageQueries: src.imageQueries, onScreenText: null, transition: "cut", motion: src.motion, characterNames: src.characterNames,
      } });
      shots.push(clone);
    }
    let t = sc.startTime ?? 0;
    for (let i = 0; i < shots.length; i++) {
      await prisma.shot.update({ where: { id: shots[i].id }, data: { order: i, duration: each, startTime: t, endTime: t + each } });
      t += each;
    }
    total += shots.length;
  }
  return { scenes: scenes.length, shots: total };
}

/**
 * AI-video projects: merge every chapter's scenes into ONE scene so clip rounding happens once per
 * chapter, not once per scene. Voice files are joined (with the scene pause), word timings offset,
 * lines and shots concatenated. Safe to call once; a chapter with a single scene is left alone.
 */
export async function mergeScenesPerChapter(projectId: string): Promise<{ merged: number }> {
  const chapters = await prisma.chapter.findMany({
    where: { projectId }, orderBy: { order: "asc" },
    include: { scenes: { orderBy: { order: "asc" }, include: { voiceSegment: true, shots: { orderBy: { order: "asc" } } } } },
  });
  const dir = projectDir(projectId, "voice");
  let merged = 0;
  for (const ch of chapters) {
    if (ch.scenes.length < 2) continue;
    const segs = ch.scenes.map((s) => s.voiceSegment);
    const hasVoice = segs.every((v) => v && v.localPath && fs.existsSync(v.localPath));
    // join voice: [seg0][pause][seg1][pause]... (pause after every segment except the last is handled by timing)
    let voice: { path: string; duration: number; words: { word: string; start: number; end: number }[] } | null = null;
    if (hasVoice) {
      const files = segs.map((v) => v!.localPath!);
      const out = path.join(dir, `chapter-${String(ch.order).padStart(2, "0")}-merged.mp3`);
      const chain = files.map((_, i) => `[${i}:a]aformat=sample_rates=44100:channel_layouts=mono${i < files.length - 1 ? `,apad=pad_dur=${SCENE_PAUSE}` : ""}[a${i}]`);
      chain.push(`${files.map((_, i) => `[a${i}]`).join("")}concat=n=${files.length}:v=0:a=1[out]`);
      await runFfmpeg([...files.flatMap((f) => ["-i", f]), "-filter_complex", chain.join(";"), "-map", "[out]", "-c:a", "libmp3lame", "-q:a", "2", out]);
      const words: { word: string; start: number; end: number }[] = [];
      let t = 0;
      for (const v of segs) {
        for (const w of ((v!.alignment as { word: string; start: number; end: number }[] | null) ?? [])) words.push({ word: w.word, start: t + w.start, end: t + w.end });
        t += v!.duration + SCENE_PAUSE;
      }
      voice = { path: out, duration: await probeDuration(out), words };
    }
    const narration = ch.scenes.map((s) => s.narration).join(" ");
    const lines = ch.scenes.flatMap((s) => ((s.lines as unknown as { speaker: string; text: string }[] | null) ?? []));
    const first = ch.scenes[0];
    // move all shots to the first scene, renumber
    let order = 0;
    for (const s of ch.scenes) for (const sh of s.shots) await prisma.shot.update({ where: { id: sh.id }, data: { sceneId: first.id, order: order++ } });
    // drop the other scenes (their voice segments go with them) and replace the first scene's voice with the merged file
    await prisma.scene.deleteMany({ where: { id: { in: ch.scenes.slice(1).map((s) => s.id) } } });
    await prisma.scene.update({ where: { id: first.id }, data: { narration, lines: lines.length ? (lines as unknown as Prisma.InputJsonValue) : undefined } });
    if (voice) {
      await prisma.voiceSegment.deleteMany({ where: { sceneId: first.id } });
      await prisma.voiceSegment.create({ data: {
        projectId, sceneId: first.id, order: ch.order, provider: segs[0]!.provider, voiceId: segs[0]!.voiceId, text: narration,
        audioUrl: publicUrl(voice.path), localPath: voice.path, duration: voice.duration, alignment: voice.words as unknown as Prisma.InputJsonValue,
      } });
    }
    merged++;
  }
  return { merged };
}
