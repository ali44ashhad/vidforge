import path from "node:path";
import fs from "node:fs";
import crypto from "node:crypto";
import { runFfmpeg, filterPath } from "../../lib/ffmpeg";
import { probeDuration } from "../../lib/media";
import { mapLimit } from "../../lib/http";
import { projectDir } from "../../lib/storage";
import type { Timeline } from "../../pipeline/timeline";
import { renderShot } from "./segments";
import { renderScene, concatScenes } from "./scenes";
import { buildNarration, buildMix, buildSfx, buildAmbience, buildMusicBed } from "./audio";
import { ctaFilters, ctaWindows } from "./cta";
import { buildPresenterTrack, presenterOverlay } from "../presenter";
import { buildCues, toSrt, captionStyle } from "./captions";
import { lookFilters } from "./looks";
import { bannerFilters } from "./banners";

export interface RenderOutput { finalPath: string; thumbPath: string; srtPath: string; duration: number; fileSize: number }
export type Progress = (pct: number, note: string) => Promise<void> | void;

const ENCODERS = Number(process.env.RENDER_PARALLEL || 2);
/** Machine-wide limit on simultaneous project renders (CPU-bound); jobs beyond it wait for a slot. */
const RENDER_SLOTS = Number(process.env.RENDER_SLOTS || 3);
let renderActive = 0; const renderWaiters: (() => void)[] = [];
async function acquireRenderSlot(): Promise<() => void> {
  if (renderActive >= RENDER_SLOTS) await new Promise<void>((ok) => renderWaiters.push(ok));
  renderActive++;
  return () => { renderActive--; renderWaiters.shift()?.(); };
}
/** Final-pass encoder speed/quality. "fast" is ~2x quicker than "medium" with no visible difference after YouTube's re-encode. */
const FINAL_PRESET = process.env.RENDER_PRESET || "fast";
const FINAL_CRF = process.env.RENDER_CRF || "20";

/** Full render: shots → scenes → video track; narration + music → mix; captions; final MP4 + thumbnail. */
export async function renderProject(tl: Timeline, onProgress: Progress, log: (m: string) => void): Promise<RenderOutput> {
  if (renderActive >= RENDER_SLOTS) { log(`waiting for a render slot (${renderActive}/${RENDER_SLOTS} busy)`); await onProgress(1, "waiting for render slot"); }
  const release = await acquireRenderSlot();
  try { return await renderProjectInner(tl, onProgress, log); } finally { release(); }
}

/**
 * One render per project. Two renders of the same project share the render folder and destroy each
 * other's work: one deletes the other's folder as "stale", or both write the same shot files.
 * The lock holds the pid; a lock from a dead process is ignored so a worker restart cannot wedge a project.
 */
function takeProjectLock(projectId: string, log: (m: string) => void): () => void {
  const lock = path.join(projectDir(projectId, "render"), ".render.lock");
  if (fs.existsSync(lock)) {
    const pid = Number(fs.readFileSync(lock, "utf8").trim());
    let alive = false;
    try { process.kill(pid, 0); alive = pid !== process.pid; } catch { alive = false; }
    if (alive) throw new Error(`another render is already running for this project (pid ${pid})`);
    log(`clearing stale render lock (pid ${pid} is gone)`);
  }
  fs.writeFileSync(lock, String(process.pid));
  return () => fs.rmSync(lock, { force: true });
}

async function renderProjectInner(tl: Timeline, onProgress: Progress, log: (m: string) => void): Promise<RenderOutput> {
  const tStart = Date.now();
  const releaseLock = takeProjectLock(tl.projectId, log);
  try {
  return await renderWithLock(tl, onProgress, log, tStart);
  } finally { releaseLock(); }
}

async function renderWithLock(tl: Timeline, onProgress: Progress, log: (m: string) => void, tStart: number): Promise<RenderOutput> {
  // Fingerprint everything that affects the picture; a different fingerprint = a fresh work folder,
  // so clips from an earlier timing of this project can never be reused by mistake.
  const fingerprint = crypto.createHash("sha1").update(JSON.stringify({
    w: tl.width, h: tl.height, fps: tl.fps,
    scenes: tl.scenes.map((s) => [s.id, +s.duration.toFixed(3), s.shots.map((x) => [x.id, +x.duration.toFixed(3), x.src, x.kind, x.motion, x.transition, x.text])]),
  })).digest("hex").slice(0, 10);
  const work = projectDir(tl.projectId, "render", fingerprint);
  // remove stale work folders from earlier timings (keeps disk usage bounded)
  for (const d of fs.readdirSync(projectDir(tl.projectId, "render"))) if (d !== fingerprint && !d.startsWith(".")) fs.rmSync(path.join(projectDir(tl.projectId, "render"), d), { recursive: true, force: true });
  log(`render folder ${fingerprint} (${tl.scenes.length} scenes, ${tl.totalDuration.toFixed(1)}s planned)`);
  const outDir = projectDir(tl.projectId, "output");
  const allShots = tl.scenes.flatMap((sc) => sc.shots);
  const shotsFile = new Map<string, string>();

  // 1. shots (parallel)
  let done = 0;
  await mapLimit(allShots, ENCODERS, async (shot, i) => {
    const sc = tl.scenes.find((s) => s.shots.includes(shot))!;
    const isLastInScene = sc.shots[sc.shots.length - 1] === shot;
    const next = isLastInScene ? null : sc.shots[sc.shots.indexOf(shot) + 1];
    const { file } = await renderShot(shot, next, tl, work, {
      fadeIn: sc.fadeIn && sc.shots[0] === shot,
      fadeOut: sc.fadeOut && isLastInScene,
    });
    shotsFile.set(shot.id, file);
    done++;
    if (done % 5 === 0 || done === allShots.length) {
      log(`shots ${done}/${allShots.length}`);
      await onProgress(Math.round((done / allShots.length) * 55), `shots ${done}/${allShots.length}`);
    }
  });

  // 2. scenes (xfade) — sequential-ish to keep memory sane
  const sceneFiles: string[] = [];
  const sceneDurations: number[] = [];
  let sdone = 0;
  await mapLimit(tl.scenes, Math.max(1, Math.floor(ENCODERS / 2)), async (sc, i) => {
    const f = await renderScene(sc, sc.shots.map((s) => shotsFile.get(s.id)!), tl, work, log);
    sceneFiles[i] = f;
    sceneDurations[i] = await probeDuration(f);
    if (Math.abs(sceneDurations[i] - sc.duration) > 0.1) log(`warning: scene ${i} is ${sceneDurations[i].toFixed(2)}s, expected ${sc.duration.toFixed(2)}s`);
    sdone++;
    await onProgress(55 + Math.round((sdone / tl.scenes.length) * 20), `scenes ${sdone}/${tl.scenes.length}`);
  });
  log(`scenes done (${tl.scenes.length}) — ${((Date.now() - tStart) / 1000).toFixed(0)}s so far`);

  // 3. video track
  const videoTrack = await concatScenes(sceneFiles, work);
  const videoDuration = await probeDuration(videoTrack);
  await onProgress(78, "video track");

  // 4. audio
  const narration = await buildNarration(tl, sceneDurations, work);
  const narrationDuration = await probeDuration(narration);
  log(`video track ${videoDuration.toFixed(2)}s, narration ${narrationDuration.toFixed(2)}s, planned ${tl.totalDuration.toFixed(2)}s`);
  if (Math.abs(videoDuration - tl.totalDuration) > 1 + tl.scenes.length * 0.05)
    throw new Error(`Video track (${videoDuration.toFixed(1)}s) does not match the planned timeline (${tl.totalDuration.toFixed(1)}s) — refusing to render out of sync`);
  const sfx = await buildSfx(tl, videoDuration, work);
  if (sfx) log(`sfx: ${tl.scenes.flatMap((s) => s.shots).filter((s) => s.card).length} chapter card(s), ${ctaWindows(videoDuration).length} subscribe cue(s)`);
  const ambience = await buildAmbience(tl, videoDuration, work).catch((e) => { log(`ambience skipped: ${(e as Error).message.slice(0, 100)}`); return null; });
  if (ambience) log(`ambience: clip sound rebuilt under the cut (${process.env.AMBIENCE_VOLUME || 0.14})`);
  const musicBed = await buildMusicBed(tl, videoDuration, work).catch((e) => { log(`music bed skipped: ${(e as Error).message.slice(0, 100)}`); return null; });
  if (musicBed) log(`music bed: chapter moods ${(tl.chapterMoods ?? []).map((c) => c.mood ?? "base").join(" → ")}`);
  const mixed = await buildMix(tl, narration, videoDuration, work, tl.mix, sfx, ambience, musicBed);
  await onProgress(85, "audio mix");

  // 5. captions
  const cues = buildCues(tl);
  const srtPath = path.join(outDir, "captions.srt");
  fs.writeFileSync(srtPath, toSrt(cues));

  // 6. final encode (burn captions if enabled, otherwise copy the video stream)
  const tFinal = Date.now();
  const finalPath = path.join(outDir, "final.mp4");
  const args = ["-i", videoTrack, "-i", mixed];
  const burnCaptions = tl.captionsEnabled && cues.length > 0;
  const logo = tl.logo && fs.existsSync(tl.logo.src) ? tl.logo : null;
  const look = lookFilters(tl.look, tl.lookIntensity, tl.width, tl.height, tl.lookParams);
  if (look) log(`look: ${tl.look}${tl.look === "auto" && tl.lookParams ? " " + JSON.stringify(tl.lookParams) : ` @ ${tl.lookIntensity}%`}`);
  // AI presenter: one square track the length of the video, overlaid as a circle
  let presenterTrack: string | null = null;
  if (tl.presenter) {
    const allShots = tl.scenes.flatMap((s) => s.shots);
    presenterTrack = await buildPresenterTrack(allShots, Math.round((tl.width * tl.presenter.size) / 100 / 2) * 2, path.join(work, "presenter"), tl.presenter.shape === "cutout" ? "cutout" : "circle", tl.presenter.photoPath);
    const withClips = tl.scenes.flatMap((s) => s.shots).filter((s) => s.presenterSrc).length;
    if (presenterTrack) log(`presenter overlay: ${tl.presenter.shape} ${tl.presenter.size}% ${tl.presenter.position.replace("_", " ")} — ${withClips} of ${tl.scenes.flatMap((s) => s.shots).length} shots have a clip`);
    else log("presenter: no clips were generated — no overlay");
  }
  const banners = bannerFilters(tl.banners, tl.width, tl.height, path.join(work, "banners"));
  if (banners.length) log(`banners: ${tl.banners?.top ?? ""} / ${tl.banners?.bottom ?? ""}`);
  const cta = ctaFilters(videoDuration, tl.width, tl.height, tl.language, path.join(work, "cta"));
  if (cta.length) log(`subscribe overlay: ${ctaWindows(videoDuration).map((w) => `${w.kind} @ ${w.start.toFixed(0)}s`).join(", ")}`);
  if (burnCaptions || logo || look || banners.length || presenterTrack || cta.length) {
    const chain: string[] = [];
    let cur = "[0:v]";
    let nextInput = 2;
    if (look) {
      // grade first, then the light leak screened on top, so captions/logo drawn later stay clean
      chain.push(`${cur}${look.chain},format=rgba[graded]`);
      cur = "[graded]";
      if (look.leak) {
        args.push("-f", "lavfi", "-i", look.leak.source);
        chain.push(`[${nextInput}:v]format=rgba[leak]`, `${cur}[leak]blend=all_mode=screen:all_opacity=${look.leak.opacity.toFixed(3)}:shortest=1,format=yuv420p[lit]`);
        cur = "[lit]"; nextInput++;
      } else {
        chain.push(`${cur}format=yuv420p[lit]`); cur = "[lit]";
      }
    }
    if (logo) {
      args.push("-i", logo.src);
      const m = Math.round(tl.width * 0.03);
      const pos = { top_right: `W-w-${m}:${m}`, top_left: `${m}:${m}`, bottom_right: `W-w-${m}:H-h-${m}`, bottom_left: `${m}:H-h-${m}` }[logo.position] ?? `W-w-${m}:${m}`;
      chain.push(`[${nextInput}:v]scale=${Math.round(tl.width * 0.11)}:-1,format=rgba,colorchannelmixer=aa=0.9[logo]`, `${cur}[logo]overlay=${pos}[vl]`);
      cur = "[vl]"; nextInput++;
    }
    if (presenterTrack && tl.presenter) {
      args.push("-i", presenterTrack);
      const o = presenterOverlay(nextInput, cur, { width: tl.width, height: tl.height, size: Math.round((tl.width * tl.presenter.size) / 100 / 2) * 2, position: tl.presenter.position, ring: tl.presenter.ring, shape: tl.presenter.shape });
      chain.push(...o.chain); cur = o.out; nextInput++;
    }
    if (cta.length) { chain.push(`${cur}${cta.join(",")}[vcta]`); cur = "[vcta]"; }
    if (banners.length) { chain.push(`${cur}${banners.join(",")}[vb]`); cur = "[vb]"; }
    // libass PlayResY is 288 for SRT: lift captions above a bottom banner (7-11% of height)
    const extraMargin = tl.banners?.bottom ? Math.round(288 * (tl.width > tl.height ? 0.11 : 0.07)) + 4 : 0;
    if (burnCaptions) { chain.push(`${cur}subtitles='${filterPath(srtPath)}':force_style='${captionStyle(tl.captionStyle, cues.map((c) => c.text).join(" "), extraMargin)}'[vc]`); cur = "[vc]"; }
    args.push("-filter_complex", chain.join(";"), "-map", cur, "-c:v", "libx264", "-preset", FINAL_PRESET, "-crf", FINAL_CRF, "-pix_fmt", "yuv420p", "-threads", "0");
  } else {
    args.push("-map", "0:v:0", "-c:v", "copy");
  }
  // Encode to a temp file and swap it in only once ffmpeg exits cleanly: the previous video stays
  // playable for the whole encode, and a failed run leaves it untouched instead of headless.
  const tmpPath = finalPath.replace(/\.mp4$/, ".tmp.mp4");
  fs.rmSync(tmpPath, { force: true });
  args.push("-map", "1:a:0", "-c:a", "aac", "-b:a", "192k", "-t", videoDuration.toFixed(3), "-movflags", "+faststart", tmpPath);
  await runFfmpeg(args, {
    timeoutMs: 6 * 60 * 60 * 1000,
    onTime: (t) => { void onProgress(85 + Math.min(13, Math.round((t / videoDuration) * 13)), "final encode"); },
  });
  const encoded = await probeDuration(tmpPath).catch(() => 0);
  if (encoded < videoDuration - 1) { fs.rmSync(tmpPath, { force: true }); throw new Error(`final encode produced ${encoded.toFixed(1)}s of ${videoDuration.toFixed(1)}s`); }
  fs.renameSync(tmpPath, finalPath);
  log(`final encode: ${((Date.now() - tFinal) / 1000).toFixed(0)}s (${FINAL_PRESET}, crf ${FINAL_CRF}, ${look ? "look on" : "no look"}, ${burnCaptions ? "captions" : "no captions"}) — total ${((Date.now() - tStart) / 1000).toFixed(0)}s`);

  // 7. thumbnail
  const thumbPath = path.join(outDir, "thumbnail.jpg");
  await runFfmpeg(["-ss", Math.min(3, videoDuration / 2).toFixed(2), "-i", finalPath, "-frames:v", "1", "-q:v", "3", thumbPath]);

  const duration = await probeDuration(finalPath);
  return { finalPath, thumbPath, srtPath, duration, fileSize: fs.statSync(finalPath).size };
}
