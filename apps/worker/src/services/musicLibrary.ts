/**
 * Music library: tracks generated once (npm run music:library) and reused. pickTrack() returns a library track for a
 * style in milliseconds; the music stage falls back to live Kie generation only when the library has nothing suitable.
 */
import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";
import { env } from "../env";
import { publicUrl } from "../lib/storage";
import { submitMusic, waitForMusic } from "./music";
import { downloadFile, probeDuration } from "../lib/media";
import { log } from "../lib/log";

export const LIBRARY_DIR = () => path.join(env.STORAGE_DIR, "library", "music");

const MOODS: Record<string, string[]> = {
  Cinematic: ["epic and hopeful", "tense and mysterious", "warm and emotional", "grand orchestral", "quiet and reflective"],
  Corporate: ["upbeat and optimistic", "clean and modern", "confident and steady"],
  Documentary: ["thoughtful and curious", "slow and atmospheric", "gently building"],
  Upbeat: ["bright pop energy", "playful and fun", "fast and motivating"],
  "Lo-fi": ["chill study beats", "warm mellow lo-fi", "late-night lo-fi"],
  Ambient: ["soft pads and space", "calm nature ambience", "meditative drone"],
  Dramatic: ["dark and building tension", "intense percussion", "cinematic suspense"],
  Inspirational: ["rising piano and strings", "hopeful anthem", "gentle uplift"],
  Electronic: ["driving synthwave", "minimal techno pulse", "future bass energy"],
  Acoustic: ["warm acoustic guitar", "folk fingerpicking", "light ukulele"],
  Horror: ["eerie drones", "creeping strings", "unsettling ambience"],
  Kids: ["cheerful and bouncy", "gentle lullaby", "playful marimba"],
};

export function libraryPrompt(style: string, mood: string) {
  return `Instrumental background music, ${style.toLowerCase()} style, ${mood}, no vocals, no lyrics, steady dynamics suitable underneath narration, loopable, 2 minutes.`;
}

/** Picks a random library track for the style (or any style as a last resort). Returns null when the library is empty. */
export async function pickTrack(style: string, minDuration = 30) {
  const wanted = style === "Auto" || style === "Custom" ? "Cinematic" : style;
  let rows = await prisma.musicLibraryTrack.findMany({ where: { style: wanted, duration: { gte: minDuration } }, orderBy: { uses: "asc" }, take: 6 });
  if (!rows.length) rows = await prisma.musicLibraryTrack.findMany({ where: { duration: { gte: minDuration } }, orderBy: { uses: "asc" }, take: 6 });
  const t = rows[Math.floor(Math.random() * rows.length)];
  if (!t || !fs.existsSync(t.localPath)) return null;
  await prisma.musicLibraryTrack.update({ where: { id: t.id }, data: { uses: { increment: 1 } } });
  return t;
}

/** Generates `perStyle` tracks for every style (skips styles that already have enough). */
export async function buildLibrary(perStyle: number, onlyStyles?: string[]) {
  fs.mkdirSync(LIBRARY_DIR(), { recursive: true });
  for (const [style, moods] of Object.entries(MOODS)) {
    if (onlyStyles && !onlyStyles.includes(style)) continue;
    const have = await prisma.musicLibraryTrack.count({ where: { style } });
    for (let i = have; i < perStyle; i++) {
      const mood = moods[i % moods.length];
      const prompt = libraryPrompt(style, mood);
      try {
        const taskId = await submitMusic(prompt, process.env.KIE_MODEL || "V4_5");
        const r = await waitForMusic(taskId, 8 * 60 * 1000);
        const dest = path.join(LIBRARY_DIR(), `${style.toLowerCase().replace(/[^a-z]/g, "")}-${Date.now()}.mp3`);
        await downloadFile(r.audioUrl, dest);
        const duration = await probeDuration(dest);
        await prisma.musicLibraryTrack.create({ data: { style, mood, prompt, localPath: dest, audioUrl: publicUrl(dest), duration } });
        log("music-library", `${style} ${i + 1}/${perStyle}: ${mood} (${duration.toFixed(0)}s)`);
      } catch (e) { log("music-library", `${style}: ${(e as Error).message.slice(0, 120)}`); if (/credits? insufficient|top up/i.test((e as Error).message)) return; }
    }
  }
}
