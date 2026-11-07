import fs from "node:fs";
import path from "node:path";
import { runFfmpeg, fileOk, filterPath } from "../../lib/ffmpeg";
import { probeDuration } from "../../lib/media";
import type { Timeline, TimelineShot } from "../../pipeline/timeline";
import { stripUnrenderable, fontFileFor } from "../../lib/text";

const ENC = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-an"];

/** Transition INTO the next shot → xfade name + duration. "cut" is a 1-frame fade (visually a hard cut). */
/**
 * Transition between two shots, clamped so it always fits. A 0.5 s dissolve between two 1.5 s shots
 * leaves xfade nothing to work with and the scene collapses, so never spend more than 30% of the
 * shorter shot on the transition, and below ~0.15 s just cut.
 */
export function xfadeBetween(transition: string, aSeconds: number, bSeconds: number): { name: string; dur: number } {
  const base = xfadeFor(transition);
  const room = Math.min(aSeconds, bSeconds) * 0.3;
  if (base.dur <= room) return base;
  return room >= 0.15 ? { name: base.name, dur: +room.toFixed(3) } : { name: "fade", dur: 0.04 };
}

export function xfadeFor(transition: string): { name: string; dur: number } {
  switch (transition) {
    case "dissolve": return { name: "fade", dur: 0.5 };
    case "fade": return { name: "fadeblack", dur: 0.6 };
    case "dip_to_black": return { name: "fadeblack", dur: 0.6 };
    case "zoom": return { name: "zoomin", dur: 0.5 };
    case "blur": return { name: "hblur", dur: 0.5 };
    case "slide": return { name: "slideleft", dur: 0.45 };
    default: return { name: "fade", dur: 0.04 };
  }
}

function wrap(text: string, width: number): string {
  const words = text.split(/\s+/); const lines: string[] = []; let cur = "";
  for (const w of words) { if ((cur + " " + w).trim().length > width) { lines.push(cur.trim()); cur = w; } else cur += " " + w; }
  if (cur.trim()) lines.push(cur.trim());
  return lines.slice(0, 4).join("\n");
}

function drawtext(textfile: string, W: number, H: number, mode: "title" | "overlay", sample: string): string {
  const f = filterPath(textfile);
  const ff = fontFileFor(sample, mode === "title" ? "display" : "overlay");
  const font = ff ? `:fontfile='${filterPath(ff)}'` : "";
  if (mode === "title")
    return `drawtext=textfile='${f}'${font}:fontsize=${Math.round(W / 24)}:fontcolor=white:x=(w-text_w)/2:y=(h-text_h)/2:line_spacing=${Math.round(W / 90)}`;
  return `drawtext=textfile='${f}'${font}:fontsize=${Math.round(W / 34)}:fontcolor=white:x=${Math.round(W * 0.06)}:y=${Math.round(H * 0.70)}:box=1:boxcolor=black@0.55:boxborderw=${Math.round(W / 100)}`;
}

/** Zoompan expression for still images (subtle Ken Burns), computed over N frames. */
function motionFilter(motion: string, W: number, H: number, frames: number): string {
  const Z = 1.12;
  const N = Math.max(2, frames);
  const zin = `1+${(Z - 1).toFixed(4)}*on/${N}`;
  const zout = `${Z}-${(Z - 1).toFixed(4)}*on/${N}`;
  const cx = "iw/2-(iw/zoom/2)", cy = "ih/2-(ih/zoom/2)";
  let z = zin, x = cx, y = cy;
  switch (motion) {
    case "zoom_out": z = zout; break;
    case "pan_left": z = String(Z); x = `(iw-iw/zoom)*(1-on/${N})`; break;
    case "pan_right": z = String(Z); x = `(iw-iw/zoom)*on/${N}`; break;
    case "ken_burns": z = zin; x = `(iw-iw/zoom)*on/${N}`; y = `(ih-ih/zoom)*0.3`; break;
    case "none": z = "1.0001"; break;
    case "zoom_slow": z = `1+0.04*on/${N}`; break; // barely-there push for sketch/whiteboard styles
    default: z = zin;
  }
  // upscale first so zoompan has pixels to work with (avoids jitter), then output at target size
  return `scale=${W * 2}:${H * 2}:force_original_aspect_ratio=increase:flags=lanczos,crop=${W * 2}:${H * 2},zoompan=z='${z}':x='${x}':y='${y}':d=${N}:s=${W}x${H}:fps=30,format=yuv420p`;
}

/**
 * Renders one shot into a normalized clip: exact length (duration + tail for the outgoing transition),
 * target size, 30 fps, no audio. Skips work if the file already exists (resume support).
 */
export async function renderShot(shot: TimelineShot, next: TimelineShot | null, tl: Timeline, dir: string, opts: { fadeIn?: boolean; fadeOut?: boolean }): Promise<{ file: string; tail: number }> {
  const { width: W, height: H, fps } = tl;
  const tail = next ? xfadeBetween(shot.transition, shot.duration, next.duration).dur : 0;
  const length = shot.duration + tail;
  const frames = Math.round(length * fps);
  const file = path.join(dir, `shot-${String(shot.order).padStart(4, "0")}.mp4`);
  // Resume: only reuse a clip that is actually the right length. A truncated file (killed render,
  // two renders sharing this folder) used to be reused as-is, which made whole scenes come up short.
  if (fileOk(file)) {
    const have = await probeDuration(file).catch(() => 0);
    if (Math.abs(have - length) <= 0.15) return { file, tail };
    fs.rmSync(file, { force: true });
  }

  const vf: string[] = [];
  const args: string[] = [];

  if (shot.kind === "video" && shot.src) {
    let srcDur = shot.srcDuration ?? 0;
    try { srcDur = await probeDuration(shot.src); } catch { /* keep provider value */ }
    // pick an offset inside the clip: prefer skipping the first second when the clip is long enough
    let offset = shot.clipOffset;
    if (offset + length > srcDur) offset = Math.max(0, srcDur - length - 0.1);
    // Always allow looping: some stock clips contain fewer frames than their header claims.
    // -frames:v caps the output, so looping never makes a shot longer than planned.
    args.push("-stream_loop", "-1", "-ss", offset.toFixed(3), "-i", shot.src);
    vf.push(`scale=${W}:${H}:force_original_aspect_ratio=increase:flags=lanczos`, `crop=${W}:${H}`, "setsar=1", `fps=${fps}`, "format=yuv420p",
      // last-resort guarantee of length: clone the final frame if the source still runs out
      `tpad=stop_mode=clone:stop_duration=${(length + 1).toFixed(2)}`);
  } else if (shot.kind === "image" && shot.src) {
    args.push("-i", shot.src);
    vf.push(motionFilter(shot.motion, W, H, frames));
  } else {
    args.push("-f", "lavfi", "-i", `color=c=0x1c1e21:s=${W}x${H}:r=${fps}`);
    const tf = path.join(dir, `title-${shot.order}.txt`);
    const t = stripUnrenderable(shot.titleText);
    fs.writeFileSync(tf, wrap(t, W > H ? 38 : 22));
    vf.push(drawtext(tf, W, H, "title", t));
  }

  const overlay = shot.kind !== "title" ? stripUnrenderable(shot.text).slice(0, 60) : "";
  if (overlay) {
    const tf = path.join(dir, `text-${shot.order}.txt`);
    fs.writeFileSync(tf, overlay);
    vf.push(drawtext(tf, W, H, "overlay", overlay));
  }
  if (opts.fadeIn) vf.push("fade=t=in:st=0:d=0.6");
  if (opts.fadeOut) vf.push(`fade=t=out:st=${Math.max(0, length - 0.8).toFixed(3)}:d=0.8`);

  await runFfmpeg([...args, "-vf", vf.join(","), "-frames:v", String(frames), "-r", String(fps), ...ENC, file], { timeoutMs: 10 * 60 * 1000 });
  const got = await probeDuration(file).catch(() => length);
  if (Math.abs(got - length) > 0.15) throw new Error(`Shot ${shot.order} rendered ${got.toFixed(2)}s instead of ${length.toFixed(2)}s`);
  return { file, tail };
}
