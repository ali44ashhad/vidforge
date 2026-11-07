/** Self-test of the render service on synthetic media (no DB, no APIs). Run: npm run render:selftest -w apps/worker */
process.env.DATABASE_URL ||= "postgresql://x:y@localhost/z";
process.env.STORAGE_DIR ||= "/tmp/rt/storage";
import path from "node:path";
import fs from "node:fs";
import { renderProject } from "../services/render";
import { assertFfmpegInstalled } from "../lib/media";
import type { Timeline } from "../pipeline/timeline";

const D = process.argv[2] || "/tmp/rt";
const words = (text: string, dur: number) => text.split(" ").map((w, i, a) => ({ word: w, start: (i / a.length) * dur, end: ((i + 1) / a.length) * dur }));

const tl: Timeline = {
  projectId: "selftest", width: 1280, height: 720, fps: 30, totalDuration: 4.35 + 3.85,
  music: { src: path.join(D, "music.mp3"), duration: 6 }, captionsEnabled: true, captionStyle: "YouTube Clean", warnings: [], voiceEnabled: true, nativeSpeech: false, presenter: null, textOverlays: true, look: "auto", lookIntensity: 70, lookParams: { contrast: 0.3, saturation: 0.5, brightness: 0.3, warmth: 0.2, sharpen: 0.6, vignette: 0, grain: 0, leak: 0 }, banners: { top: "₹8000 में 10 Ads Videos", topHighlight: "₹8000", bottom: "Book Your 10 Video Package", color: "#FF7A00" }, mix: { musicVolume: 0.3 }, logo: fs.existsSync(path.join(D, "logo.png")) ? { src: path.join(D, "logo.png"), position: "top_right" } : null,
  scenes: [
    { id: "s0", chapterOrder: 0, order: 0, start: 0, duration: 4.35, voiceSrc: path.join(D, "v0.mp3"), voiceDuration: 4,
      words: words("This is the first scene of our self test video", 4), fadeIn: true, fadeOut: false,
      shots: [
        { id: "a", order: 0, start: 0, duration: 2.0, kind: "video", src: path.join(D, "clip1.mp4"), srcDuration: 3, clipOffset: 0, transition: "dissolve", motion: "none", text: "Short clip, looped", titleText: "" },
        { id: "b", order: 1, start: 2.0, duration: 2.35, kind: "image", src: path.join(D, "photo.jpg"), srcDuration: null, clipOffset: 0, transition: "cut", motion: "pan_right", text: "", titleText: "" },
      ] },
    { id: "s1", chapterOrder: 0, order: 1, start: 4.35, duration: 3.85, voiceSrc: path.join(D, "v1.mp3"), voiceDuration: 3.5,
      words: words("And here is the second scene with a title card", 3.5), fadeIn: false, fadeOut: true,
      shots: [
        { id: "c", order: 2, start: 4.35, duration: 1.85, kind: "video", src: path.join(D, "clip2.mp4"), srcDuration: 12, clipOffset: 0, transition: "slide", motion: "none", text: "", titleText: "" },
        { id: "d", order: 3, start: 6.2, duration: 2.0, kind: "title", src: null, srcDuration: null, clipOffset: 0, transition: "cut", motion: "none", text: "", titleText: "A title card: what happens when no stock footage matches?" },
      ] },
  ],
};

(async () => {
  await assertFfmpegInstalled();
  fs.rmSync(path.join(process.env.STORAGE_DIR!, "projects", "selftest"), { recursive: true, force: true });
  const t0 = Date.now();
  const out = await renderProject(tl, (p, n) => { console.log(`  ${p}% ${n}`); }, (m) => console.log("  " + m));
  console.log(`OK in ${((Date.now() - t0) / 1000).toFixed(1)}s →`, out.finalPath, `${out.duration.toFixed(2)}s (expected ${tl.totalDuration.toFixed(2)}s)`, `${(out.fileSize / 1e6).toFixed(2)} MB`);
  console.log("captions:", fs.readFileSync(out.srtPath, "utf8").split("\n").slice(0, 8).join(" | "));
})().catch((e) => { console.error("FAILED:", e.message); process.exit(1); });
