import { spawn } from "node:child_process";
import fs from "node:fs";
import { env } from "../env";

export interface FfmpegOptions {
  /** Called with seconds of output produced so far (parsed from ffmpeg's progress lines). */
  onTime?: (seconds: number) => void;
  timeoutMs?: number;
}

/** Runs ffmpeg with an argument array (no shell, so no quoting problems). Throws with the last stderr lines on failure. */
export function runFfmpeg(args: string[], opts: FfmpegOptions = {}): Promise<void> {
  return new Promise((resolve, reject) => {
    const proc = spawn(env.FFMPEG_PATH, ["-hide_banner", "-nostdin", "-y", "-loglevel", "error", "-stats", ...args]);
    let stderr = "";
    const timer = opts.timeoutMs ? setTimeout(() => { proc.kill("SIGKILL"); reject(new Error(`ffmpeg timed out after ${opts.timeoutMs}ms`)); }, opts.timeoutMs) : null;
    proc.stderr.on("data", (d: Buffer) => {
      const s = d.toString();
      stderr = (stderr + s).slice(-6000);
      const m = s.match(/time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
      if (m && opts.onTime) opts.onTime(Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]));
    });
    proc.on("error", (e) => { if (timer) clearTimeout(timer); reject(e); });
    proc.on("close", (code) => {
      if (timer) clearTimeout(timer);
      if (code === 0) resolve();
      else reject(new Error(`ffmpeg exited with ${code}\nargs: ${args.join(" ").slice(0, 1500)}\n${stderr.split("\n").filter(Boolean).slice(-8).join("\n")}`));
    });
  });
}

export function fileOk(p: string | null | undefined): p is string {
  return !!p && fs.existsSync(p) && fs.statSync(p).size > 0;
}

/** Escapes a path for use inside an ffmpeg filter option (subtitles=, textfile=). */
export function filterPath(p: string): string {
  return p.replace(/\\/g, "/").replace(/:/g, "\\:").replace(/'/g, "\\'");
}
