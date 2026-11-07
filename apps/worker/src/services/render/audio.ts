import path from "node:path";
import fs from "node:fs";
import { execFile } from "node:child_process";
import { runFfmpeg } from "../../lib/ffmpeg";
import type { Timeline } from "../../pipeline/timeline";

import { DEFAULT_MIX, type MixSettings } from "@vidforge/shared";
export { DEFAULT_MIX, type MixSettings };

/**
 * Narration track: each scene's voice padded with silence to the scene's VIDEO length
 * (measured, so audio and picture stay locked scene by scene), then concatenated.
 */
export async function buildNarration(tl: Timeline, sceneVideoDurations: number[], dir: string): Promise<string> {
  const parts: string[] = [];
  for (let i = 0; i < tl.scenes.length; i++) {
    const sc = tl.scenes[i];
    const len = sceneVideoDurations[i];
    const out = path.join(dir, `voice-${String(i).padStart(3, "0")}.wav`);
    if (tl.nativeSpeech) {
      // stitch each clip's own speech audio (silence where a clip has none), padded to the clip's slot
      const parts: string[] = [];
      for (let k = 0; k < sc.shots.length; k++) {
        const sh = sc.shots[k];
        const seg = path.join(dir, `shotaudio-${String(i).padStart(3, "0")}-${k}.wav`);
        if (sh.audioSrc) await runFfmpeg(["-i", sh.audioSrc, "-af", `apad=whole_dur=${sh.duration.toFixed(3)}`, "-t", sh.duration.toFixed(3), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", seg]);
        else await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", sh.duration.toFixed(3), "-c:a", "pcm_s16le", seg]);
        parts.push(seg);
      }
      const list = path.join(dir, `shotaudio-${i}.txt`);
      fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
      await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-af", `apad=whole_dur=${len.toFixed(3)}`, "-t", len.toFixed(3), "-c:a", "pcm_s16le", out]);
    } else if (sc.voiceSrc) {
      await runFfmpeg(["-i", sc.voiceSrc, "-af", `apad=whole_dur=${len.toFixed(3)}`, "-t", len.toFixed(3), "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
    } else {
      await runFfmpeg(["-f", "lavfi", "-i", "anullsrc=r=48000:cl=stereo", "-t", len.toFixed(3), "-c:a", "pcm_s16le", out]); // silence
    }
    parts.push(out);
  }
  const list = path.join(dir, "voice.txt");
  fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n") + "\n");
  const out = path.join(dir, "narration.wav");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-c:a", "pcm_s16le", out]);
  return out;
}

import { ctaWindows } from "./cta";
import { env } from "../../env";

/**
 * Sound-effect track, synthesised with ffmpeg's lavfi sources so no asset files are needed:
 * a whoosh on every chapter card, a low impact under the first card (the "film begins" moment), and a
 * two-note chime as the subscribe overlay slides in. Returns null when there is nothing to place.
 * SFX=off disables it.
 */
export async function buildSfx(tl: Timeline, total: number, dir: string): Promise<string | null> {
  if (process.env.SFX === "off") return null;
  const events: { at: number; src: { file?: string; vol?: number; lavfi?: string } }[] = [];
  const cards = tl.scenes.flatMap((s) => s.shots).filter((sh) => sh.card === "chapter");
  // Real sound files win when present: drop whoosh.mp3, impact.mp3, chime.mp3 (mp3/wav) into SFX_DIR
  // (default <storage>/library/sfx). Anything missing falls back to the synthesised version.
  const sfxDir = process.env.SFX_DIR || path.join(env.STORAGE_DIR, "library", "sfx");
  const fileFor = (name: string) => [".mp3", ".wav", ".m4a"].map((x) => path.join(sfxDir, name + x)).find((f) => fs.existsSync(f)) ?? null;
  const gain = (name: string, fallback: number) => Number(process.env[`SFX_GAIN_${name.toUpperCase()}`] || fallback);
  const src = (name: string, synth: string, vol: number) => { const f = fileFor(name); return f ? { file: f, vol: gain(name, vol) } : { lavfi: synth }; };
  const whoosh = src("whoosh", "anoisesrc=d=0.9:color=pink:amplitude=0.7,highpass=f=250,lowpass=f=3800,afade=t=in:st=0:d=0.3,afade=t=out:st=0.4:d=0.5,volume=0.55", 0.6);
  const hit = src("impact", "sine=f=52:d=1.6,afade=t=out:st=0.05:d=1.5,volume=0.9", 0.8);
  const chime = src("chime", "sine=f=880:d=0.5,afade=t=out:st=0.05:d=0.45,volume=0.32", 0.5);
  const chime2 = fileFor("chime") ? null : { lavfi: "sine=f=1174.7:d=0.6,afade=t=out:st=0.05:d=0.55,volume=0.28" };
  // A hit under every card: the scene's hook line ends right before it, so the impact lands on the reveal.
  // The title card gets the full hit; later cards a softer one. SFX_HIT_EVERY_CARD=off restores title-only.
  const hitSoft = src("impact", "sine=f=52:d=1.4,afade=t=out:st=0.05:d=1.3,volume=0.5", 0.45);
  cards.forEach((c, i) => { events.push({ at: Math.max(0, c.start - 0.15), src: whoosh }); events.push({ at: c.start, src: i === 0 || process.env.SFX_HIT_EVERY_CARD === "off" ? (i === 0 ? hit : whoosh) : hitSoft }); });
  for (const w of ctaWindows(total)) { events.push({ at: w.start + 0.1, src: chime }); if (chime2) events.push({ at: w.start + 0.3, src: chime2 }); }
  if (!events.length) return null;
  const out = path.join(dir, "sfx.wav");
  const args: string[] = [];
  const labels: string[] = [];
  events.forEach((e, i) => {
    const s = e.src as { file?: string; vol?: number; lavfi?: string };
    if (s.file) args.push("-i", s.file); else args.push("-f", "lavfi", "-i", s.lavfi!);
    labels.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:4${s.file ? `,volume=${s.vol}` : ""},adelay=${Math.round(e.at * 1000)}|${Math.round(e.at * 1000)}[e${i}]`);
  });
  const fc = [...labels, `${events.map((_, i) => `[e${i}]`).join("")}amix=inputs=${events.length}:duration=longest:dropout_transition=0:normalize=0,apad=whole_dur=${total.toFixed(3)},atrim=0:${total.toFixed(3)}[sfx]`].join(";");
  await runFfmpeg([...args, "-filter_complex", fc, "-map", "[sfx]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out], { timeoutMs: 10 * 60 * 1000 });
  return out;
}

function hasAudioStream(file: string): Promise<boolean> {
  return new Promise((res) => execFile("ffprobe", ["-v", "error", "-select_streams", "a:0", "-show_entries", "stream=codec_type", "-of", "csv=p=0", file], { timeout: 20_000 }, (err, out) => res(!err && /audio/.test(String(out)))));
}

/**
 * SCENE AMBIENCE. Every AI clip carries the sound Veo generated for it — train hiss, crowd murmur, rain, room tone.
 * The picture assembly drops it; this rebuilds it as one continuous bed that follows the cut exactly: each shot's
 * clip audio for that shot's span (fade in/out so cuts don't click), silence under cards and stills. Mixed low and
 * ducked under narration in buildMix. AMBIENCE=off disables; AMBIENCE_VOLUME (default 0.14) sets the level.
 */
export async function buildAmbience(tl: Timeline, total: number, dir: string): Promise<string | null> {
  if (process.env.AMBIENCE === "off" || tl.nativeSpeech) return null;
  const shots = tl.scenes.flatMap((s) => s.shots).sort((a, b) => a.start - b.start);
  const segDir = path.join(dir, "ambience"); fs.mkdirSync(segDir, { recursive: true });
  const parts: string[] = []; let cursor = 0, used = 0;
  const silence = async (d: number) => { if (d < 0.02) return; const f = path.join(segDir, `s${parts.length}.wav`); await runFfmpeg(["-f", "lavfi", "-i", `anullsrc=r=48000:cl=stereo:d=${d.toFixed(3)}`, "-c:a", "pcm_s16le", f]); parts.push(f); };
  for (const sh of shots) {
    if (sh.start > cursor + 0.02) await silence(sh.start - cursor);
    const d = sh.duration;
    if (sh.kind === "video" && sh.src && fs.existsSync(sh.src) && (await hasAudioStream(sh.src))) {
      const f = path.join(segDir, `a${parts.length}.wav`);
      const fo = Math.max(0, d - 0.35).toFixed(3);
      try {
        await runFfmpeg(["-ss", (sh.clipOffset || 0).toFixed(3), "-t", d.toFixed(3), "-i", sh.src, "-vn", "-af",
          `aformat=sample_rates=48000:channel_layouts=stereo,apad,atrim=0:${d.toFixed(3)},asetpts=N/SR/TB,afade=t=in:st=0:d=0.35,afade=t=out:st=${fo}:d=0.35`, "-c:a", "pcm_s16le", f], { timeoutMs: 60_000 });
        parts.push(f); used++;
      } catch { await silence(d); }
    } else await silence(d);
    cursor = sh.start + d;
  }
  if (total > cursor + 0.02) await silence(total - cursor);
  if (!used) return null;
  const list = path.join(segDir, "list.txt");
  fs.writeFileSync(list, parts.map((f) => `file '${f.replace(/'/g, "'\\''")}'`).join("\n"));
  const out = path.join(dir, "ambience.wav");
  await runFfmpeg(["-f", "concat", "-safe", "0", "-i", list, "-t", total.toFixed(3), "-c:a", "pcm_s16le", out], { timeoutMs: 10 * 60 * 1000 });
  return out;
}

/**
 * MUSIC THAT FOLLOWS THE STORY. When mood tracks exist, the music bed is built chapter by chapter: each chapter's span
 * gets the track for its mood (base track when untagged), looped to length, with a 3-second crossfade at every change.
 * Returns null when there is nothing to switch between, and buildMix falls back to the single looped track.
 */
export async function buildMusicBed(tl: Timeline, total: number, dir: string): Promise<string | null> {
  if (!tl.music || !Object.keys(tl.moodTracks ?? {}).length) return null;
  const spans: { start: number; end: number; src: string }[] = [];
  for (const cm of tl.chapterMoods ?? []) {
    const sc = tl.scenes.filter((s) => s.chapterOrder === cm.order);
    if (!sc.length) continue;
    const start = Math.min(...sc.map((s) => s.start)), end = Math.max(...sc.map((s) => s.start + s.duration));
    const src = (cm.mood && tl.moodTracks[cm.mood]?.src) || tl.music.src;
    const last = spans[spans.length - 1];
    if (last && last.src === src && Math.abs(last.end - start) < 0.05) last.end = end; else spans.push({ start, end, src });
  }
  if (spans.length < 2) return null;
  const X = 3; // crossfade seconds
  const inputs: string[] = []; const chains: string[] = []; const labels: string[] = [];
  spans.forEach((sp, i) => {
    inputs.push("-stream_loop", "-1", "-i", sp.src);
    const s0 = Math.max(0, sp.start - (i ? X / 2 : 0)), e0 = Math.min(total, sp.end + (i < spans.length - 1 ? X / 2 : 0));
    const d = e0 - s0;
    chains.push(`[${i}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${d.toFixed(3)},asetpts=N/SR/TB,afade=t=in:st=0:d=${i ? X : 0.01},afade=t=out:st=${Math.max(0, d - (i < spans.length - 1 ? X : 0.01)).toFixed(3)}:d=${i < spans.length - 1 ? X : 0.01},adelay=${Math.round(s0 * 1000)}|${Math.round(s0 * 1000)}[b${i}]`);
    labels.push(`[b${i}]`);
  });
  const out = path.join(dir, "musicbed.wav");
  await runFfmpeg([...inputs, "-filter_complex", `${chains.join(";")};${labels.join("")}amix=inputs=${spans.length}:duration=longest:dropout_transition=0:normalize=0,atrim=0:${total.toFixed(3)}[out]`, "-map", "[out]", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out], { timeoutMs: 20 * 60 * 1000 });
  return out;
}

/** Final mix: narration + looped music with sidechain ducking, fades, loudness normalisation (+ SFX and ambience when given). */
export async function buildMix(tl: Timeline, narration: string, total: number, dir: string, mixIn?: Partial<MixSettings> | null, sfx?: string | null, ambience?: string | null, musicBed?: string | null): Promise<string> {
  const mix: MixSettings = { ...DEFAULT_MIX, ...(mixIn ?? {}) };
  if (!tl.voiceEnabled && !tl.nativeSpeech) { mix.duck = 1; if (mixIn?.musicVolume == null) mix.musicVolume = 0.8; } // no narration: music carries the video
  mix.musicVolume = Math.min(1, Math.max(0, mix.musicVolume));
  mix.voiceVolume = Math.min(2, Math.max(0.2, mix.voiceVolume));
  mix.duck = Math.min(20, Math.max(1, mix.duck));
  const out = path.join(dir, "mix.wav");
  const norm = "loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000";
  const T = total.toFixed(3);
  const ambVol = Number(process.env.AMBIENCE_VOLUME || 0.14);
  // inputs: 0 narration, then music (looped single track or prebuilt bed), then sfx, then ambience — in that order when present
  const inputs: string[] = ["-i", narration];
  let idx = 1; let iMusic = -1, iSfx = -1, iAmb = -1;
  if (tl.music) { if (musicBed) inputs.push("-i", musicBed); else inputs.push("-stream_loop", "-1", "-i", tl.music.src); iMusic = idx++; }
  if (sfx) { inputs.push("-i", sfx); iSfx = idx++; }
  if (ambience) { inputs.push("-i", ambience); iAmb = idx++; }
  const fadeOutStart = Math.max(0, total - mix.fadeOut).toFixed(3);
  const fc: string[] = [];
  const mixed: string[] = ["[v1]"];
  const splits = 1 + (iMusic >= 0 ? 1 : 0) + (iAmb >= 0 ? 1 : 0);
  fc.push(`[0:a]aformat=sample_rates=48000:channel_layouts=stereo,volume=${mix.voiceVolume},asplit=${splits}[v1]${iMusic >= 0 ? "[v2]" : ""}${iAmb >= 0 ? "[v3]" : ""}`);
  if (iMusic >= 0) {
    fc.push(`[${iMusic}:a]aformat=sample_rates=48000:channel_layouts=stereo,atrim=0:${T},asetpts=N/SR/TB,afade=t=in:st=0:d=${mix.fadeIn},afade=t=out:st=${fadeOutStart}:d=${mix.fadeOut},volume=${mix.musicVolume}[m]`);
    fc.push(`[m][v2]sidechaincompress=threshold=0.02:ratio=${mix.duck}:attack=60:release=900:makeup=1[md]`);
    mixed.push("[md]");
  }
  if (iSfx >= 0) { fc.push(`[${iSfx}:a]aformat=sample_rates=48000:channel_layouts=stereo[sx]`); mixed.push("[sx]"); }
  if (iAmb >= 0) {
    // band-limited so it never fights the voice, gently ducked under narration (ratio 3, not the music's 12)
    fc.push(`[${iAmb}:a]aformat=sample_rates=48000:channel_layouts=stereo,highpass=f=90,lowpass=f=7000,volume=${ambVol},afade=t=in:st=0:d=2,afade=t=out:st=${fadeOutStart}:d=${mix.fadeOut}[am]`);
    fc.push(`[am][v3]sidechaincompress=threshold=0.03:ratio=3:attack=80:release=1200:makeup=1[amd]`);
    mixed.push("[amd]");
  }
  fc.push(`${mixed.join("")}amix=inputs=${mixed.length}:duration=first:dropout_transition=0:normalize=0,${norm}[out]`);
  await runFfmpeg([...inputs, "-filter_complex", fc.join(";"), "-map", "[out]", "-t", T, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out], { timeoutMs: 20 * 60 * 1000 });
  return out;
}
