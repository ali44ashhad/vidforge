import path from "node:path";
import fs from "node:fs";
import { runFfmpeg, fileOk } from "../../lib/ffmpeg";
import { probeDuration } from "../../lib/media";
import type { Timeline, TimelineScene } from "../../pipeline/timeline";
import { xfadeBetween } from "./segments";

const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an"];

/** Normalises one input for xfade/concat: constant fps, same pixel format, timestamps from 0, common timebase. */
function norm(i: number, fps: number) {
  return `[${i}:v]fps=${fps},format=yuv420p,setpts=PTS-STARTPTS,settb=AVTB[s${i}]`;
}

/**
 * Joins a scene's shot clips with xfade transitions. Each clip was rendered with an extra tail equal to
 * its outgoing transition, so the net scene length is exactly the sum of shot durations.
 * The result is verified; if xfade misbehaves (seen with some ffmpeg builds) the scene falls back to
 * hard cuts via the concat filter, which is deterministic.
 */
export async function renderScene(scene: TimelineScene, shotFiles: string[], tl: Timeline, dir: string, log?: (m: string) => void): Promise<string> {
  const out = path.join(dir, `scene-${String(scene.chapterOrder).padStart(2, "0")}-${String(scene.order).padStart(3, "0")}.mp4`);
  if (fileOk(out)) {
    const d = await probeDuration(out).catch(() => 0);
    if (Math.abs(d - scene.duration) <= 0.2) return out;
    fs.rmSync(out, { force: true }); // stale/incorrect — rebuild
  }
  const target = scene.duration.toFixed(3);
  const inputs = shotFiles.flatMap((f) => ["-i", f]);
  const tail = `tpad=stop_mode=clone:stop_duration=3,trim=duration=${target},setpts=PTS-STARTPTS[v]`;

  if (shotFiles.length === 1) {
    await runFfmpeg(["-i", shotFiles[0], "-filter_complex", `${norm(0, tl.fps)};[s0]${tail}`, "-map", "[v]", "-r", String(tl.fps), ...ENC, out]);
    const one = await probeDuration(out).catch(() => 0);
    if (Math.abs(one - scene.duration) > 0.2) throw new Error(`Scene ${scene.chapterOrder}/${scene.order} (single shot) rendered ${one.toFixed(2)}s instead of ${target}s`);
    return out;
  }

  // --- attempt 1: xfade transitions ---
  const parts: string[] = shotFiles.map((_, i) => norm(i, tl.fps));
  let offset = 0, prev = "[s0]";
  for (let i = 0; i < shotFiles.length - 1; i++) {
    const { name, dur } = xfadeBetween(scene.shots[i].transition, scene.shots[i].duration, scene.shots[i + 1].duration);
    offset += scene.shots[i].duration;
    const label = `[x${i}]`;
    parts.push(`${prev}[s${i + 1}]xfade=transition=${name}:duration=${dur.toFixed(3)}:offset=${offset.toFixed(3)}${label}`);
    prev = label;
  }
  parts.push(`${prev}${tail}`);
  try {
    await runFfmpeg([...inputs, "-filter_complex", parts.join(";"), "-map", "[v]", "-r", String(tl.fps), ...ENC, out], { timeoutMs: 20 * 60 * 1000 });
    const got = await probeDuration(out);
    if (Math.abs(got - scene.duration) <= 0.2) return out;
    log?.(`scene ${scene.chapterOrder}/${scene.order}: xfade produced ${got.toFixed(2)}s of ${target}s — falling back to cuts`);
  } catch (e) {
    log?.(`scene ${scene.chapterOrder}/${scene.order}: xfade failed (${(e as Error).message.split("\n")[0]}) — falling back to cuts`);
  }

  // --- attempt 2: hard cuts (trim each clip to its planned duration, concat) ---
  fs.rmSync(out, { force: true });
  const cut: string[] = shotFiles.map((_, i) => `[${i}:v]fps=${tl.fps},format=yuv420p,setpts=PTS-STARTPTS,trim=duration=${scene.shots[i].duration.toFixed(3)},setpts=PTS-STARTPTS,settb=AVTB[c${i}]`);
  cut.push(`${shotFiles.map((_, i) => `[c${i}]`).join("")}concat=n=${shotFiles.length}:v=1:a=0[cc]`, `[cc]${tail}`);
  await runFfmpeg([...inputs, "-filter_complex", cut.join(";"), "-map", "[v]", "-r", String(tl.fps), ...ENC, out], { timeoutMs: 20 * 60 * 1000 });
  const got = await probeDuration(out).catch(() => 0);
  if (Math.abs(got - scene.duration) <= 0.2) return out;
  if (got > 0 && got < scene.duration) {
    // Short by a real margin: hold the last frame to fill the gap rather than failing a 20-minute render.
    log?.(`scene ${scene.chapterOrder}/${scene.order}: ${got.toFixed(2)}s of ${target}s — padding the last frame`);
    const padded = out.replace(/\.mp4$/, "-pad.mp4");
    await runFfmpeg(["-i", out, "-vf", `tpad=stop_mode=clone:stop_duration=${(scene.duration - got + 1).toFixed(3)},trim=duration=${target},setpts=PTS-STARTPTS`, "-r", String(tl.fps), ...ENC, padded], { timeoutMs: 20 * 60 * 1000 });
    const after = await probeDuration(padded).catch(() => 0);
    if (Math.abs(after - scene.duration) <= 0.2) { fs.renameSync(padded, out); return out; }
    fs.rmSync(padded, { force: true });
  }
  throw new Error(`Scene ${scene.chapterOrder}/${scene.order} rendered ${got.toFixed(2)}s instead of ${target}s even with cuts`);
}

/** Concatenates scene files without re-encoding (all scenes share identical encoding settings). */
export async function concatScenes(sceneFiles: string[], dir: string): Promise<string> {
  const out = path.join(dir, "video-track.mp4");
  const list = path.join(dir, "scenes.txt");
  fs.writeFileSync(list, sceneFiles.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", "-movflags", "+faststart", out], { timeoutMs: 20 * 60 * 1000 });
  return out;
}
