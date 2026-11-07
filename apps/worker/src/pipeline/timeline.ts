import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";
import { frameSize, findStyle, type MixSettings, type LookParams } from "@vidforge/shared";
import { fileOk } from "../lib/ffmpeg";
import { projectDir } from "../lib/storage";

/** Everything the renderer needs, resolved from the DB and validated. Saved as timeline.json. */
export interface TimelineShot {
  id: string;
  order: number;            // global order
  start: number;
  duration: number;
  kind: "video" | "image" | "title";
  src: string | null;       // local file
  srcDuration: number | null;
  clipOffset: number;
  transition: string;       // transition INTO the next shot (applied at this shot's end)
  motion: string;
  audioSrc?: string | null; // native-speech mode: this clip's speech audio
  presenterSrc?: string | null; // AI presenter clip for this shot (face-cam overlay)
  dialogue?: string | null;
  text: string;             // on-screen text overlay ("" = none)
  titleText: string;        // used when kind === "title"
  card?: "chapter";         // a chapter title card inserted by the timeline (gets a whoosh in the mix)
}
export interface TimelineScene {
  id: string;
  chapterOrder: number;
  order: number;
  start: number;
  duration: number;         // includes trailing pause
  voiceSrc: string | null;      // null when voiceover is disabled
  voiceDuration: number;
  words: { word: string; start: number; end: number }[];
  shots: TimelineShot[];
  fadeIn: boolean;          // first scene of video
  fadeOut: boolean;         // last scene of video
}
export interface Timeline {
  projectId: string;
  width: number;
  height: number;
  fps: number;
  totalDuration: number;
  music: { src: string; duration: number } | null;
  moodTracks: Record<string, { src: string; duration: number }>;   // "[mood:tense]" tracks, keyed by mood
  chapterMoods: { order: number; mood: string | null }[];
  captionsEnabled: boolean;
  captionStyle: string;
  voiceEnabled: boolean;
  nativeSpeech: boolean;
  language: string;
  presenter: { position: string; size: number; ring: string; shape: string; photoPath: string | null } | null;
  textOverlays: boolean;
  look: string;
  lookIntensity: number;
  lookParams: LookParams | null;
  banners: { top?: string; topHighlight?: string; bottom?: string; color?: string } | null;
  mix: Partial<MixSettings> | null;
  logo: { src: string; position: string } | null;
  scenes: TimelineScene[];
  warnings: string[];
}

function estimateDialogueWords(text: string, duration: number): { word: string; start: number; end: number }[] {
  const words = text.split(/\s+/).filter(Boolean);
  const usable = Math.max(1, duration - 0.6), each = usable / Math.max(1, words.length);
  return words.map((word, i) => ({ word, start: 0.3 + i * each, end: 0.3 + (i + 1) * each - 0.05 }));
}

export async function buildTimeline(projectId: string): Promise<Timeline> {
  const p = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const ratio = frameSize(p.aspectRatio, p.outputQuality);
  const preset = findStyle(p.imageStyle);
  const textInImage = !!preset?.textInImage;
  const subtleMotion = preset?.motion === "subtle";
  const chapters = await prisma.chapter.findMany({
    where: { projectId }, orderBy: { order: "asc" },
    include: { scenes: { orderBy: { order: "asc" }, include: { voiceSegment: true, shots: { orderBy: { order: "asc" }, include: { mediaAsset: true } } } } },
  });
  const tracks = await prisma.musicTrack.findMany({ where: { projectId, status: "READY" }, orderBy: { createdAt: "desc" } });
  const music = tracks.find((t) => !t.prompt.startsWith("[mood:")) ?? null;
  const moodTracks: Record<string, { src: string; duration: number }> = {};
  for (const t of tracks) { const m = t.prompt.match(/^\[mood:(\w+)\]/)?.[1]; if (m && !moodTracks[m] && fileOk(t.localPath)) moodTracks[m] = { src: t.localPath, duration: t.duration ?? 0 }; }
  const chapterMoods = chapters.map((c) => ({ order: c.order, mood: c.musicMood ?? null }));

  const warnings: string[] = [];
  const scenes: TimelineScene[] = [];
  let t = 0, shotIndex = 0;
  const allScenes = chapters.flatMap((c) => c.scenes.map((s, j) => ({ ...s, chapterOrder: c.order, chapterTitle: c.title, firstInChapter: j === 0 })));
  // Chapter title cards: a 2.4 s card at the start of every chapter after the first, so viewers can see the
  // structure. Chapter one is the cold open, so the first card is also the "this is where the film begins" marker.
  // The card takes its time from the chapter's first shot, so scene and voice lengths are untouched.
  const CARD = 2.4;
  const cardsOn = process.env.CHAPTER_CARDS !== "off" && chapters.length > 1 && p.targetDuration >= 180;
  const cardLabel = (n: number, title: string) => (/hindi/i.test(p.language) ? `अध्याय ${n}` : `Chapter ${n}`) + " — " + title.trim();
  // the first card, right after the cold open, is the film's own title — the clear "the story starts here" moment
  const filmTitle = p.title.split(/\s*[|｜]\s*/)[0].trim().slice(0, 90);
  let firstCard = true;

  for (let si = 0; si < allScenes.length; si++) {
    const s = allScenes[si];
    const v = s.voiceSegment;
    if (p.voiceEnabled && (!v || !fileOk(v.localPath))) throw new Error(`Voice audio missing for scene ${s.order} of chapter ${s.chapterOrder + 1} — retry VOICE_GENERATION`);
    const sceneDuration = (s.endTime ?? 0) - (s.startTime ?? 0);
    if (sceneDuration <= 0) throw new Error(`Scene ${s.id} has no timing — timing engine did not run`);
    if (p.voiceEnabled && v && (sceneDuration < v.duration - 0.05 || sceneDuration > v.duration + 2))
      throw new Error(`Scene ${s.order} of chapter ${s.chapterOrder + 1}: slot ${sceneDuration.toFixed(1)}s vs voice ${v.duration.toFixed(1)}s — timing is stale, run VOICE_GENERATION again`);

    const shots: TimelineShot[] = [];
    let st = 0;
    if (cardsOn && s.firstInChapter && si > 0 && s.shots.length && s.shots[0].duration >= CARD + 1.5) {
      shots.push({
        id: `${s.id}-card`, order: shotIndex++, start: t, duration: CARD, kind: "title", src: null, srcDuration: null, clipOffset: 0,
        transition: "fade", motion: "none", text: "", titleText: firstCard ? filmTitle : cardLabel(s.chapterOrder + 1, s.chapterTitle), card: "chapter",
      });
      firstCard = false;
      st += CARD;
    }
    for (const sh of s.shots) {
      // the chapter card borrowed its seconds from this shot
      const cardTaken = shots.length === 1 && shots[0].card ? CARD : 0;
      const asset = sh.mediaAsset;
      let kind: TimelineShot["kind"] = "title";
      let src: string | null = null;
      if (asset && fileOk(asset.localPath)) {
        kind = asset.type === "VIDEO" ? "video" : "image";
        src = asset.localPath;
      } else if (asset) {
        warnings.push(`Shot "${sh.visualDescription}" media file missing on disk — using title card`);
      }
      shots.push({
        id: sh.id, order: shotIndex++, start: t + st, duration: sh.duration - cardTaken, kind, src,
        srcDuration: asset?.duration ?? null, clipOffset: sh.clipOffset, transition: sh.transition,
        motion: subtleMotion && kind === "image" ? "zoom_slow" : sh.motion,
        // only native-speech mode plays a clip's own audio; in presenter mode the clips are silent overlays
        audioSrc: p.speechMode === "veo_native" && sh.audioPath && fileOk(sh.audioPath) ? sh.audioPath : null, dialogue: sh.dialogue,
        presenterSrc: sh.presenterPath && fileOk(sh.presenterPath) ? sh.presenterPath : null,
        // when the style draws its labels inside the image (whiteboard, chalkboard...), don't add an overlay on AI images
        text: p.textOverlaysEnabled && !(textInImage && asset && asset.provider !== "pexels") ? (sh.onScreenText ?? "") : "",
        titleText: sh.onScreenText || sh.visualDescription,
      });
      st += sh.duration - cardTaken;
    }
    if (!shots.length) throw new Error(`Scene ${s.id} has no shots`);
    // guarantee coverage: stretch the last shot to the scene's end
    const drift = sceneDuration - st;
    if (Math.abs(drift) > 0.02) shots[shots.length - 1].duration += drift;

    scenes.push({
      id: s.id, chapterOrder: s.chapterOrder, order: s.order, start: t, duration: sceneDuration,
      voiceSrc: p.voiceEnabled && v ? v.localPath! : null, voiceDuration: p.voiceEnabled && v ? v.duration : sceneDuration,
      words: p.voiceEnabled && v ? ((v.alignment as TimelineScene["words"]) ?? [])
        : p.speechMode === "veo_native" ? shots.flatMap((sh) => sh.dialogue ? estimateDialogueWords(sh.dialogue.replace(/^[^:]{1,40}:\s*/, ""), sh.duration).map((w) => ({ ...w, start: w.start + (sh.start - t), end: w.end + (sh.start - t) })) : []) : [],
      shots, fadeIn: si === 0, fadeOut: si === allScenes.length - 1,
    });
    t += sceneDuration;
  }

  if (!scenes.length) throw new Error("Timeline is empty");
  if (music && !fileOk(music.localPath)) { warnings.push("Music file missing on disk — rendering without music"); }

  const timeline: Timeline = {
    projectId, width: ratio.width, height: ratio.height, fps: 30, totalDuration: t,
    music: music && fileOk(music.localPath) ? { src: music.localPath!, duration: music.duration ?? 0 } : null,
    moodTracks, chapterMoods,
    captionsEnabled: p.captionsEnabled && (p.voiceEnabled || p.speechMode === "veo_native" || p.presenterMode === "ai"), captionStyle: p.captionStyle, scenes, warnings,
    voiceEnabled: p.voiceEnabled,
    // ONE VOICE: only native-speech mode uses the clips' own audio. AI presenter always narrates with TTS and its
    // clips are muted, so a video can never mix the TTS voice with Veo's invented voices.
    nativeSpeech: p.speechMode === "veo_native",
    language: p.language,
    presenter: p.presenterMode === "ai" ? { position: p.presenterPosition, size: p.presenterSize, ring: p.presenterRing, shape: p.presenterShape, photoPath: p.presenterImagePath ?? null } : null, textOverlays: p.textOverlaysEnabled, look: p.look, lookIntensity: p.lookIntensity, lookParams: (p.lookParams as LookParams | null) ?? null,
    banners: (p.banners as Timeline["banners"]) ?? null,
    mix: (p.mixSettings as Partial<MixSettings> | null) ?? null,
    logo: p.logoPath && fileOk(p.logoPath) ? { src: p.logoPath, position: p.logoPosition } : null,
  };
  if (p.logoPath && !fileOk(p.logoPath)) warnings.push("Logo file missing on disk — rendering without logo");
  if (!p.musicEnabled) timeline.music = null;
  validate(timeline);
  fs.writeFileSync(path.join(projectDir(projectId), "timeline.json"), JSON.stringify(timeline, null, 2));
  return timeline;
}

/** Coverage validation: continuous from 0 to the end, no gaps/overlaps, every shot has a source or a title card. */
function validate(tl: Timeline) {
  let expect = 0;
  for (const sc of tl.scenes) {
    if (Math.abs(sc.start - expect) > 0.02) throw new Error(`Gap before scene ${sc.order} (expected ${expect.toFixed(2)}, got ${sc.start.toFixed(2)})`);
    let s = sc.start;
    for (const sh of sc.shots) {
      if (Math.abs(sh.start - s) > 0.02) throw new Error(`Gap before shot ${sh.order}`);
      if (sh.duration < 0.2) throw new Error(`Shot ${sh.order} too short (${sh.duration.toFixed(2)}s)`);
      s += sh.duration;
    }
    if (Math.abs(s - (sc.start + sc.duration)) > 0.05) throw new Error(`Scene ${sc.order} shots do not cover its duration`);
    expect = sc.start + sc.duration;
  }
  if (Math.abs(expect - tl.totalDuration) > 0.05) throw new Error("Timeline does not reach the final audio timestamp");
}

export function loadTimeline(projectId: string): Timeline {
  const f = path.join(projectDir(projectId), "timeline.json");
  if (!fs.existsSync(f)) throw new Error("timeline.json missing — ASSEMBLING must run first");
  return JSON.parse(fs.readFileSync(f, "utf8")) as Timeline;
}
