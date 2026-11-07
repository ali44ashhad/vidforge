import { execFile } from "node:child_process";
import fs from "node:fs";
import { promisify } from "node:util";
import { fetchRetry } from "./http";
import { env } from "../env";

const execFileP = promisify(execFile);

/** Real duration in seconds using ffprobe (must be installed: `brew install ffmpeg`). */
export async function probeDuration(filePath: string): Promise<number> {
  const { stdout } = await execFileP(env.FFPROBE_PATH, [
    "-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath,
  ]);
  const d = parseFloat(stdout.trim());
  if (!Number.isFinite(d)) throw new Error(`ffprobe could not read duration of ${filePath}`);
  return d;
}

const REQUIRED_FILTERS = ["drawtext", "subtitles", "xfade", "zoompan", "sidechaincompress", "loudnorm"];

/** Checks that ffmpeg/ffprobe exist AND include the filters the renderer needs. */
export async function assertFfmpegInstalled() {
  try {
    await execFileP(env.FFPROBE_PATH, ["-version"]);
  } catch {
    throw new Error(`ffprobe not found at "${env.FFPROBE_PATH}". Mac: brew install ffmpeg-full   VPS: apt install ffmpeg`);
  }
  let filters = "";
  try {
    filters = (await execFileP(env.FFMPEG_PATH, ["-hide_banner", "-filters"], { maxBuffer: 4 * 1024 * 1024 })).stdout;
  } catch {
    throw new Error(`ffmpeg not found at "${env.FFMPEG_PATH}". Mac: brew install ffmpeg-full   VPS: apt install ffmpeg`);
  }
  const missing = REQUIRED_FILTERS.filter((f) => !new RegExp(`\\s${f}\\s`).test(filters));
  if (missing.length)
    throw new Error(
      `ffmpeg at "${env.FFMPEG_PATH}" is missing filters: ${missing.join(", ")}. ` +
      `On Mac the Homebrew "ffmpeg" formula is a slim build — run: brew uninstall ffmpeg && brew install ffmpeg-full ` +
      `(or set FFMPEG_PATH/FFPROBE_PATH in .env to a full build).`
    );
}

/** Downloads a URL to disk (skips if the file already exists and is non-empty). */
export async function downloadFile(url: string, dest: string): Promise<void> {
  if (fs.existsSync(dest) && fs.statSync(dest).size > 0) return;
  const res = await fetchRetry(url);
  if (!res.ok || !res.body) throw new Error(`download failed ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  fs.writeFileSync(dest + ".part", buf);
  fs.renameSync(dest + ".part", dest);
}

/** Width/height/duration of a media file via ffprobe. */
export async function probeMedia(filePath: string): Promise<{ width: number; height: number; duration: number }> {
  const { stdout } = await execFileP(env.FFPROBE_PATH, ["-v", "error", "-select_streams", "v:0", "-show_entries", "stream=width,height:format=duration", "-of", "json", filePath]);
  const j = JSON.parse(stdout) as { streams?: { width?: number; height?: number }[]; format?: { duration?: string } };
  return { width: j.streams?.[0]?.width ?? 0, height: j.streams?.[0]?.height ?? 0, duration: Number(j.format?.duration ?? 0) };
}
