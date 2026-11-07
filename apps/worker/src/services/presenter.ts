/**
 * AI presenter ("face cam"): Veo generates a lip-synced clip of the presenter (from one photo) speaking a part of the
 * script; the clips are composited as a circle (or a green-screen cut-out) over the video.
 *
 * ONE VOICE RULE: the clips are always MUTED in the render. The TTS narration is the only voice in the video, and a
 * clip's length never changes a shot's duration — the narration owns the timeline from the VOICE_GENERATION stage on.
 * Veo is still asked to speak the line, because that is what makes the lips move; we simply throw the audio away.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";
import { generateAiVideo } from "./videoProvider";
import { downloadFile, probeDuration } from "../lib/media";
import { runFfmpeg } from "../lib/ffmpeg";
import { projectDir, publicUrl } from "../lib/storage";

export const PRESENTER_CLIP_SECONDS = 8;

/**
 * Splits each scene's narration into spoken PARTS of about one clip's worth of speech (~PRESENTER_CLIP_SECONDS of
 * video time) and stores each part on the shot where it starts. One Veo clip is generated per part, and that clip
 * covers every shot the part spans — so with 1.5-3 s cuts the face keeps talking instead of freezing on a still.
 * Shot durations are NEVER touched here.
 */
export async function assignPresenterLines(projectId: string, language: string, log: (m: string) => void): Promise<Map<string, string>> {
  const scenes = await prisma.scene.findMany({ where: { chapter: { projectId } }, orderBy: [{ chapter: { order: "asc" } }, { order: "asc" }], include: { shots: { orderBy: { order: "asc" } } } });
  const wps = /hindi|punjabi|bengali|tamil|telugu|marathi|gujarati|urdu/i.test(language) ? 2.1 : 2.6; // words per second
  const lines = new Map<string, string>();
  for (const sc of scenes) {
    if (!sc.shots.length) continue;
    const sentences = (sc.narration || "").match(/[^.!?।]+[.!?।]+["']?\s*|[^.!?।]+$/g)?.map((x) => x.trim()).filter(Boolean) ?? [];
    if (!sentences.length) continue;
    // windows: consecutive shots grouped until they add up to about one clip's length; each window starts on a shot
    const windows: { shotId: string; seconds: number }[] = [];
    for (const sh of sc.shots) {
      const d = Math.max(0.3, sh.duration);
      const last = windows[windows.length - 1];
      if (!last || last.seconds >= PRESENTER_CLIP_SECONDS * 0.9) windows.push({ shotId: sh.id, seconds: d });
      else last.seconds += d;
    }
    // hand the sentences out window by window, proportional to each window's length (never splitting a sentence)
    let si = 0;
    for (let w = 0; w < windows.length; w++) {
      const isLast = w === windows.length - 1;
      const budget = Math.max(6, Math.round(Math.min(PRESENTER_CLIP_SECONDS, windows[w].seconds) * wps));
      const picked: string[] = [];
      let words = 0;
      while (si < sentences.length) {
        const n = sentences[si].split(/\s+/).filter(Boolean).length;
        if (picked.length && !isLast && words + n > budget * 1.3) break;
        picked.push(sentences[si++]); words += n;
        if (!isLast && words >= budget) break;
      }
      const text = picked.join(" ").trim().slice(0, 320);
      if (!text || text.split(/\s+/).filter(Boolean).length < 4) continue;
      await prisma.shot.update({ where: { id: windows[w].shotId }, data: { dialogue: text } });
      lines.set(windows[w].shotId, text);
    }
  }
  log(`presenter script split into ${lines.size} spoken part(s)`);
  return lines;
}

/** One presenter clip for a shot, saved locally; returns null when generation fails (video continues without a face cam). */
export const CHROMA = "#00B140"; // broadcast green for cut-out mode

export async function generatePresenterClip(args: { projectId: string; shotId: string; text: string; photoUrl: string; language: string; continuityUrl?: string | null; cutout?: boolean; log: (m: string) => void }): Promise<{ localPath: string; url: string; duration: number; lastFrameUrl: string } | null> {
  const dir = projectDir(args.projectId, "presenter");
  fs.mkdirSync(dir, { recursive: true });
  // continuity: after the first clip, start from the previous clip's last frame so the presenter, clothing,
  // framing and background stay identical across the whole video.
  const start = args.continuityUrl || args.photoUrl;
  const bg = args.cutout
    ? `standing in front of a completely flat, evenly lit solid chroma-key green screen (${CHROMA}) that fills the whole background, no props, no shadows falling on the green, sharp edges around hair and shoulders`
    : "soft even lighting, simple uncluttered background";
  const prompt = `${args.continuityUrl ? `Continue the same shot with the same person, same clothing, same framing and the same background as the start frame — nothing in the scene changes${args.cutout ? " (the background stays a flat green screen)" : ""}` : `The person from the reference photo, filmed as a talking-head video: head and shoulders, centred with the face in the upper third, looking straight into the camera, ${bg}`}. Natural head movement and hand gestures. They say, in ${args.language} with accurate lip-sync: ${args.text.replace(/^([^:]{1,40}):\s*/, "")} — spoken at a natural pace within the clip. Clear voice, no background music, no captions, no text, static camera.`;
  try {
    const v = await generateAiVideo(prompt, "16:9", start, "720p", [args.photoUrl], { keepSpeech: true });
    const localPath = path.join(dir, `${args.shotId}.mp4`);
    await downloadFile(v.url, localPath);
    const duration = await probeDuration(localPath);
    // last frame → start image for the next clip (continuity)
    const lastFrame = localPath.replace(/\.mp4$/, "-last.jpg");
    await runFfmpeg(["-sseof", "-0.4", "-i", localPath, "-frames:v", "1", "-q:v", "3", lastFrame]);
    await prisma.shot.update({ where: { id: args.shotId }, data: { presenterPath: localPath, presenterUrl: publicUrl(localPath) } });
    return { localPath, url: publicUrl(localPath), duration, lastFrameUrl: fs.existsSync(lastFrame) ? publicUrl(lastFrame) : publicUrl(localPath) };
  } catch (e) { args.log(`presenter clip failed: ${(e as Error).message.slice(0, 140)}`); return null; }
}

/**
 * Builds one presenter track as long as the video. The timeline is split into SLOTS: a new slot begins at every shot
 * that has a generated clip, and the clip-less shots after it extend that slot. Each slot plays its clip, looping it
 * when the slot is longer than the clip — so the presenter keeps moving across fast cuts instead of freezing on a
 * still frame. The shots before the first clip reuse the first clip (the overlay is muted, so being ahead of the
 * narration is invisible). Audio is stripped from every part.
 */
export async function buildPresenterTrack(shots: { presenterSrc?: string | null; duration: number }[], size: number, dir: string, shape: "circle" | "cutout" = "circle", _photoPath?: string | null): Promise<string | null> {
  const first = shots.find((s) => s.presenterSrc && fs.existsSync(s.presenterSrc))?.presenterSrc;
  if (!first) return null;
  fs.mkdirSync(dir, { recursive: true });
  const slots: { src: string; seconds: number }[] = [];
  let lead = 0;
  for (const s of shots) {
    const src = s.presenterSrc && fs.existsSync(s.presenterSrc) ? s.presenterSrc : null;
    const d = Math.max(0, s.duration);
    if (src) slots.push({ src, seconds: d });
    else if (slots.length) slots[slots.length - 1].seconds += d;
    else lead += d;
  }
  if (lead > 0.05) slots.unshift({ src: first, seconds: lead });
  // circle: square crop biased to the top so the face is centred, not the chest. cut-out: keep the 16:9 frame, key later.
  const vf = shape === "cutout"
    ? `scale=${size}:-2,fps=30,setsar=1`
    : `scale=${size}:${size}:force_original_aspect_ratio=increase,crop=${size}:${size}:(iw-${size})/2:(ih-${size})*0.18,fps=30,setsar=1`;
  const parts: string[] = [];
  for (let i = 0; i < slots.length; i++) {
    const out = path.join(dir, `p-${String(i).padStart(3, "0")}.mp4`);
    const t = Math.max(0.1, slots[i].seconds).toFixed(3);
    await runFfmpeg(["-stream_loop", "-1", "-i", slots[i].src, "-an", "-vf", `${vf},tpad=stop_mode=clone:stop_duration=1`, "-t", t, "-c:v", "libx264", "-preset", "veryfast", "-crf", "22", "-pix_fmt", "yuv420p", out]);
    parts.push(out);
  }
  const list = path.join(dir, "presenter.txt");
  fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const track = path.join(dir, "presenter-track.mp4");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c", "copy", track]);
  return track;
}

/** filter_complex fragment: circular mask + ring, then overlay at the chosen corner. */
export function presenterOverlay(input: number, cur: string, opts: { width: number; height: number; size: number; position: string; ring: string; shape?: string }): { chain: string[]; out: string } {
  const m0 = Math.round(opts.width * 0.04);
  if (opts.shape === "cutout") {
    // green screen keyed out: only the presenter remains, standing at the chosen side
    const pos = ({ bottom_left: `${m0}:H-h`, bottom_right: `W-w-${m0}:H-h`, top_left: `${m0}:0`, top_right: `W-w-${m0}:0` } as Record<string, string>)[opts.position] ?? `${m0}:H-h`;
    return { chain: [`[${input}:v]scale=${opts.size}:-2,format=rgba,colorkey=0x00B140:0.30:0.12,despill=type=green:mix=0.5:expand=0.2[pip]`, `${cur}[pip]overlay=${pos}:shortest=0[vp]`], out: "[vp]" };
  }
  const s = opts.size;
  const rw = Math.max(3, Math.round(s * 0.035)); // ring width
  const hex = opts.ring.replace("#", "");
  const [rr, gg, bb] = [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2) || "6C", 16));
  const d = `pow(X-${(s / 2).toFixed(1)},2)+pow(Y-${(s / 2).toFixed(1)},2)`;
  const rIn = Math.pow(s / 2 - rw, 2).toFixed(1), rOut = Math.pow(s / 2, 2).toFixed(1);
  const mask = `format=rgba,geq=r='if(gt(${d},${rIn}),${rr},r(X,Y))':g='if(gt(${d},${rIn}),${gg},g(X,Y))':b='if(gt(${d},${rIn}),${bb},b(X,Y))':a='if(gt(${d},${rOut}),0,255)'`;
  const m = Math.round(opts.width * 0.04);
  const pos = ({ bottom_left: `${m}:H-h-${Math.round(opts.height * 0.08)}`, bottom_right: `W-w-${m}:H-h-${Math.round(opts.height * 0.08)}`, top_left: `${m}:${m}`, top_right: `W-w-${m}:${m}` } as Record<string, string>)[opts.position] ?? `${m}:H-h-${Math.round(opts.height * 0.08)}`;
  return { chain: [`[${input}:v]scale=${s}:${s},${mask}[pip]`, `${cur}[pip]overlay=${pos}:shortest=0[vp]`], out: "[vp]" };
}
