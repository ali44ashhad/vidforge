import path from "node:path";
import { generatePresenterClip, assignPresenterLines } from "../../services/presenter";
import { probeMedia } from "../../lib/media";
import fs from "node:fs";
import { prisma, type Prisma } from "@vidforge/db";
import { ASPECT_RATIOS, frameSize, findStyle, type Strategy } from "@vidforge/shared";
import type { StageDefinition } from "../types";
import { searchVideos, searchPhotos, scoreCandidate, type Candidate, type Orientation } from "../../services/pexels";
import { imagePrompt, kieAspect } from "../../services/images";
import { generateAiImage } from "../../services/imageProvider";
import { generateAiVideo } from "../../services/videoProvider";
import { env } from "../../env";
import { mapLimit } from "../../lib/http";
import { downloadFile } from "../../lib/media";
import { runFfmpeg } from "../../lib/ffmpeg";
import crypto from "node:crypto";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolveVoiceId, synthesizeToFile, normalizeForSpeech } from "../../services/voice";
const execFileP = promisify(execFile);
import { projectDir, publicUrl } from "../../lib/storage";
import { bumpStats } from "../stats";
import { startMusicEarly } from "./music";

type ShotRow = Awaited<ReturnType<typeof loadShots>>[number];
async function loadShots(projectId: string) {
  return prisma.shot.findMany({
    where: { scene: { chapter: { projectId } } },
    include: { scene: { include: { chapter: true } } },
    orderBy: [{ scene: { chapter: { order: "asc" } } }, { scene: { order: "asc" } }, { order: "asc" }],
  });
}

/**
 * FETCHING_MEDIA — three modes:
 *   stock_videos : Pexels videos → Pexels photos → title card
 *   mixed        : Pexels videos → Kie AI image → Pexels photos → title card
 *   ai_images    : Kie AI image for every shot → Pexels photos → title card
 */
export const fetchingMedia: StageDefinition = {
  name: "FETCHING_MEDIA",
  async run(ctx) {
    const p = ctx.project;
    const strategy = (p.strategy as Strategy | null) ?? null;
    const ratio = { ...(ASPECT_RATIOS.find((a) => a.value === p.aspectRatio) ?? ASPECT_RATIOS[0]), ...frameSize(p.aspectRatio, p.outputQuality) };
    const orientation: Orientation = ratio.width > ratio.height ? "landscape" : ratio.width < ratio.height ? "portrait" : "square";
    const requested = p.visualSource || "mixed";
    // user-uploaded references: subject/character/location go into every generation; style frames too (as look guidance)
    const userRefs = ((p.referenceImages as { url: string; path: string; kind: string; label: string }[] | null) ?? []).filter((r) => r.path || r.url);
    const refSource = (r: { url: string; path: string }) => (/^https?:\/\//.test(r.url) && !/localhost|127\.0\.0\.1/.test(r.url) ? r.url : r.path);
    const refText = userRefs.length
      ? " Reference images are attached: " + userRefs.map((r, i) => `image ${i + 1} is ${r.kind === "style" ? "a STYLE reference — match its colours, lighting and rendering style, not its content" : `the ${r.kind}${r.label ? ` "${r.label}"` : ""} — it must appear exactly as shown`}`).join("; ") + "."
      : "";
    if (userRefs.length) ctx.log(`using ${userRefs.length} user reference image(s): ${userRefs.map((r) => `${r.kind}${r.label ? ":" + r.label : ""}`).join(", ")}`);
    const aiVideo = requested === "ai_videos" ? "all" : requested === "ai_video_hero" ? "hero" : "none";
    // Long videos run on SnapGen, short ones on whatever VIDEO_PROVIDER says (Kie/Veo 3 today).
    // LONGFORM_MIN_SECONDS sets the boundary; VIDEO_PROVIDER_LONGFORM overrides which provider long videos use.
    const longForm = p.targetDuration >= Number(process.env.LONGFORM_MIN_SECONDS || 300);
    const videoProvider = longForm ? (process.env.VIDEO_PROVIDER_LONGFORM || "snapgen") : (process.env.VIDEO_PROVIDER || "snapgen");
    if (aiVideo !== "none") ctx.log(`AI video provider: ${videoProvider}${longForm ? " (long-form)" : ""}`);
    const mode = p.storyMode && aiVideo === "none" ? "ai_images" : (aiVideo !== "none" ? "ai_images" : requested);
    const preset = findStyle(p.imageStyle);
    const style = preset ? preset.id : p.storyMode
      ? (p.videoType === "Kids Story" ? `${p.imageStyle || "Storybook illustration"}, children's book, friendly, bright colours` : (p.imageStyle || "Cinematic photo"))
      : p.imageStyle;
    const styleText = preset ? preset.prompt : (style || "cinematic photo");

    // Story mode: make sure every character has a reference image before drawing any shot
    const refs = new Map<string, string>(); // name → provider URL usable as image reference
    // Veo rejects prompts that name "specific characters"; the storyboard writes visuals by name. Before a
    // video prompt is sent, each cast name is replaced by the character's appearance — the reference frame
    // keeps the face, the words describe someone filmable.
    const castLook = new Map<string, string>();
    const describeCast = (text: string) => { for (const [name, look] of castLook) text = text.split(name).join(look); return text; };
    if (p.storyMode) {
      const pcs = await prisma.projectCharacter.findMany({ where: { projectId: p.id }, include: { character: true }, orderBy: { order: "asc" } });
      for (const { character: c } of pcs) castLook.set(c.name, c.description.split(/[.;]/)[0].trim().slice(0, 90) || c.name);
      await mapLimit(pcs, env.IMAGE_CONCURRENCY, async ({ character: c }) => {
        if (c.referenceImageUrl) { refs.set(c.name, c.referenceImageUrl); return; }
        const attrs = [c.gender, c.ageGroup, c.ethnicity].filter(Boolean).join(", ");
        const prompt = `Character design sheet of ${c.name}${attrs ? ` (${attrs})` : ""}: ${c.description}. ${c.personality ? `Personality: ${c.personality}.` : ""} Style: ${styleText}. Full body, standing, front view, friendly expression, plain white background, no text, no watermark.`;
        try {
          const charRefs = userRefs.filter((r) => r.kind === "character" && r.label && c.name.toLowerCase().includes(r.label.toLowerCase())).map(refSource);
          const url = (await generateAiImage(prompt + (charRefs.length ? " The character must match the attached reference image exactly." : ""), "1:1", charRefs, style)).url;
          const localPath = path.join(projectDir(p.id, "characters"), `${c.id}.jpg`);
          await downloadFile(url, localPath);
          await prisma.character.update({ where: { id: c.id }, data: { referenceImageUrl: url, referenceImagePath: localPath, referencePublicUrl: publicUrl(localPath) } });
          refs.set(c.name, url);
          ctx.log(`reference image ready for ${c.name}`);
        } catch (e) {
          ctx.log(`reference image failed for ${c.name}: ${(e as Error).message} — shots will rely on the text description`);
        }
      });
      await bumpStats(p.id, { characters: pcs.length });
    }

    const shots = await loadShots(p.id);
    if (!shots.length) throw new Error("No shots found — STORYBOARDING must run first");
    startMusicEarly(ctx); // music overlaps image/video generation

    const usedRows = await prisma.projectAsset.findMany({
      where: p.batchId ? { project: { batchId: p.batchId } } : { projectId: p.id },
      include: { mediaAsset: { select: { providerAssetId: true } } },
    });
    const usedIds = new Set(usedRows.map((u) => u.mediaAsset.providerAssetId));
    const dir = projectDir(p.id, "media");
    const counts = { videos: 0, images: 0, aiImages: 0, aiVideos: 0, missing: 0, processed: 0 };
    // shots that already have media (from an earlier attempt) are counted, not regenerated
    const existing = await prisma.shot.findMany({ where: { scene: { chapter: { projectId: p.id } }, mediaAssetId: { not: null } }, include: { mediaAsset: { select: { type: true, provider: true } } } });
    for (const s of existing) { if (s.mediaAsset?.type === "VIDEO") { if (s.mediaAsset.provider === "pexels") counts.videos++; else counts.aiVideos++; } else if (s.mediaAsset?.provider === "pexels") counts.images++; else counts.aiImages++; }
    await bumpStats(p.id, { videosFound: counts.videos, imagesFound: counts.images, aiImages: counts.aiImages, aiImageFailures: 0, shotsWithoutMedia: 0 });

    /** Turns a finished image shot into an AI video clip (image-to-video). Falls back to the image on failure. */
    const native = p.speechMode === "veo_native";
    const animate = async (shot: ShotRow, imageUrl: string | null, imageMeta: Record<string, unknown>) => {
      const speech = native && shot.dialogue
        ? ` ${shot.dialogue.replace(/^([^:]{1,40}):\s*/, (_m, who) => `${who} looks at the camera and says, in ${p.language} (${p.language} pronunciation, not Hindi), with accurate lip-sync: `)} — the whole line is spoken within the clip at a natural pace, then a short pause; natural voice, clear speech, no background music, no subtitles.`
        : "";
      const motion = imageUrl
        ? `${shot.visualDescription}. Subtle, realistic camera and subject motion (${shot.motion.replace("_", " ")}), no text, no captions, consistent with the start frame.${native && p.aspectRatio === "R9_16" ? " Subject centred in frame (will be cropped to vertical)." : ""}`
        : `${shot.visualDescription}. ${styleText}, ${strategy?.tone ?? "cinematic"}. Camera: ${shot.motion.replace("_", " ")}. Smooth motion, no captions, no watermark.`;
      // AI_VIDEO_RETRIES (default 3): a clip is tried this many times, with a growing pause, before the shot
      // becomes a still — so provider hiccups and one-off refusals don't leave frozen frames in a film.
      const tries = aiVideo === "all" ? Math.max(1, Number(process.env.AI_VIDEO_RETRIES || 3)) : 1;
      let lastErr: Error | null = null;
      for (let attempt = 1; attempt <= tries; attempt++) {
      try {
        if (attempt > 1) { ctx.log(`  retrying clip (${attempt}/${tries}) for "${shot.visualDescription.slice(0, 40)}"`); await new Promise((r) => setTimeout(r, 30_000 * (attempt - 1))); }
        // Non-native clips: ask for ambient sound only, so their audio can sit under the narration as scene ambience
        const ambientOnly = native || process.env.AMBIENCE === "off" ? "" : " Sound: natural ambient sound of the scene only (weather, machines, crowd, room tone) — no speech, no dialogue, no singing, no music.";
        const v = await generateAiVideo(describeCast(motion) + speech + (imageUrl ? "" : refText) + ambientOnly, native ? "16:9" : kieAspect(p.aspectRatio), imageUrl, p.aiVideoResolution, userRefs.map(refSource), { keepSpeech: native, provider: videoProvider });
        await attach(shot, {
          provider: "snapgen", providerAssetId: v.id, type: "VIDEO", url: v.url, previewUrl: imageUrl ?? "", creator: `SnapGen (${v.model})`,
          creatorUrl: "https://snapgen.ai", sourceUrl: "https://snapgen.ai", width: ratio.width, height: ratio.height, duration: v.duration, slugWords: [],
          meta: { ...imageMeta, videoPrompt: motion, videoGenerationId: v.id, videoModel: v.model, startImage: imageUrl } as Prisma.InputJsonValue,
        });
        counts.aiVideos++;
        if (native) await captureShotSpeech(shot);
        return true;
      } catch (e) { lastErr = e as Error; }
      }
      ctx.log(`AI video failed ${tries}x for "${shot.visualDescription.slice(0, 50)}" — keeping the image: ${lastErr?.message.split("\n")[0].slice(0, 160)}`);
      return false;
    };

    // AI presenter: one lip-synced clip per narrated shot, from the presenter photo; its speech becomes the narration
    const presenterPhoto = p.presenterMode === "ai" ? (p.presenterImageUrl || null) : null;
    let presenterContinuity: string | null = null; // last frame of the previous clip → same look and background throughout
    // the shots were loaded before these lines were written, so keep the map and read from it (not the stale rows)
    const attach = async (shot: ShotRow, pick: Candidate & { meta?: Prisma.InputJsonValue }) => {
      const ext = pick.type === "VIDEO" ? ".mp4" : ".jpg";
      const localPath = path.join(dir, `${pick.provider}-${pick.providerAssetId}${ext}`);
      await downloadFile(pick.url, localPath);
      if (pick.type === "VIDEO" && !pick.previewUrl) {
        // no start image → take a frame from the clip for the storyboard thumbnails
        const frame = `${localPath}.jpg`;
        try { await runFfmpeg(["-ss", "1", "-i", localPath, "-frames:v", "1", "-vf", "scale=640:-1", "-q:v", "4", frame]); pick.previewUrl = publicUrl(frame); } catch { /* optional */ }
      }
      const asset = await prisma.mediaAsset.upsert({
        where: { provider_providerAssetId: { provider: pick.provider, providerAssetId: pick.providerAssetId } },
        create: {
          provider: pick.provider, providerAssetId: pick.providerAssetId, type: pick.type, url: pick.url, localPath,
          previewUrl: pick.previewUrl, creator: pick.creator, creatorUrl: pick.creatorUrl, sourceUrl: pick.sourceUrl,
          license: pick.provider === "pexels" ? "Pexels License" : `${pick.provider} generated image (see provider terms)`,
          width: pick.width, height: pick.height, duration: pick.duration, meta: pick.meta, downloadedAt: new Date(),
        },
        update: { localPath, downloadedAt: new Date() },
      });
      await prisma.shot.update({ where: { id: shot.id }, data: { mediaAssetId: asset.id } });
      await prisma.projectAsset.upsert({
        where: { projectId_mediaAssetId: { projectId: p.id, mediaAssetId: asset.id } },
        create: { projectId: p.id, mediaAssetId: asset.id }, update: {},
      });
      usedIds.add(pick.providerAssetId);
    };

    /** Native speech: pull the clip's audio to a wav; if the clip is silent, synthesize the line with TTS as a fallback. */
    const captureShotSpeech = async (shot: ShotRow) => {
      const fresh = await prisma.shot.findUnique({ where: { id: shot.id }, include: { mediaAsset: true } });
      const src = fresh?.mediaAsset?.localPath;
      if (!src) return;
      const out = path.join(projectDir(p.id, "voice"), `shot-${shot.id}.wav`);
      let hasAudio = false;
      try {
        const { stdout } = await execFileP(env.FFPROBE_PATH, ["-v", "error", "-select_streams", "a", "-show_entries", "stream=codec_type", "-of", "csv=p=0", src]);
        hasAudio = stdout.includes("audio");
      } catch { /* treat as silent */ }
      if (hasAudio) {
        await runFfmpeg(["-i", src, "-vn", "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
      } else if (shot.dialogue) {
        ctx.log(`clip for "${shot.visualDescription.slice(0, 40)}" has no speech audio — using TTS for its line`);
        const text = normalizeForSpeech(shot.dialogue.replace(/^[^:]{1,40}:\s*/, ""), p.language);
        const voiceId = await resolveVoiceId(p.voiceStyle, p.voiceId, p.language, prisma as never);
        const mp3 = out.replace(/\.wav$/, ".mp3");
        await synthesizeToFile({ text, voiceId, style: "Conversational", speed: p.voiceSpeed, dest: mp3, language: p.language });
        await runFfmpeg(["-i", mp3, "-ar", "48000", "-ac", "2", "-c:a", "pcm_s16le", out]);
      } else return;
      await prisma.shot.update({ where: { id: shot.id }, data: { audioPath: out } });
    };

    const presenterLines = presenterPhoto ? await assignPresenterLines(p.id, p.language, ctx.log) : new Map<string, string>();
    // AI presenter: ONE clip per spoken part by default, so the face is talking for the whole video. The clips run in
    // ONE SEQUENTIAL PASS — each starts from the previous clip's last frame, so the person, clothing, framing and
    // background stay identical. Two attempts per clip (Veo fails intermittently); a part with no clip is covered by
    // the previous clip, which keeps playing (see buildPresenterTrack), so nothing freezes.
    // PRESENTER_MAX_CLIPS caps the number of generated clips (0 or unset = one per spoken part). Set it on long
    // videos, where one clip per part means a lot of Veo time and credits.
    // The clips are MUTED in the render: the TTS narration is the only voice, and clip length never changes a shot.
    if (presenterPhoto && presenterLines.size) {
      const ordered = [...shots].sort((a, b) => (a.scene.chapter.order - b.scene.chapter.order) || (a.scene.order - b.scene.order) || (a.order - b.order));
      const withLines = ordered.filter((sh) => (presenterLines.get(sh.id) || "").trim());
      const cap = Math.max(0, Math.floor(Number(process.env.PRESENTER_MAX_CLIPS || 0)));
      const budget = cap > 0 ? Math.min(cap, withLines.length) : withLines.length;
      const step = Math.max(1, Math.ceil(withLines.length / Math.max(1, budget)));
      const chosen = new Set((budget >= withLines.length ? withLines : withLines.filter((_, i) => i % step === 0).slice(0, budget)).map((sh) => sh.id));
      ctx.log(`presenter: generating ${chosen.size} clip(s) for ${withLines.length} spoken part(s)${chosen.size < withLines.length ? ` — capped by PRESENTER_MAX_CLIPS=${cap}` : ""}`);
      let n = 0;
      for (const shot of ordered) {
        const text = (presenterLines.get(shot.id) || "").trim();
        if (!text || shot.presenterPath || !chosen.has(shot.id)) continue;
        n++;
        ctx.log(`presenter clip ${n}/${chosen.size}: "${text.slice(0, 50)}…"`);
        for (let attempt = 1; attempt <= 2; attempt++) {
          const clip = await generatePresenterClip({ projectId: p.id, shotId: shot.id, text, photoUrl: presenterPhoto, language: p.language, continuityUrl: presenterContinuity, cutout: p.presenterShape === "cutout", log: ctx.log });
          if (clip) { presenterContinuity = clip.lastFrameUrl; counts.aiVideos++; break; }
          if (attempt === 2) ctx.log(`  clip ${n} gave up after 2 attempts — the previous clip covers this part`);
        }
        await bumpStats(p.id, { presenterClips: n });
      }
      ctx.log("presenter: clips are silent overlays — the narration voice and the shot timings are unchanged");
    }


    const findStockVideo = async (shot: ShotRow, vocab: string[]): Promise<{ c: Candidate; s: number } | null> => {
      const scored: { c: Candidate; s: number }[] = [];
      for (let i = 0; i < shot.videoQueries.length; i++) {
        try {
          for (const c of await searchVideos(shot.videoQueries[i], orientation, ratio.width, ratio.height))
            scored.push({ c, s: scoreCandidate({ candidate: c, queryWords: vocab, shotDuration: shot.duration, orientation, usedIds, queryRank: i }) });
        } catch (e) { ctx.log(`video search failed "${shot.videoQueries[i]}": ${(e as Error).message}`); }
        const best = scored.filter((x) => !usedIds.has(x.c.providerAssetId)).sort((a, b) => b.s - a.s)[0];
        if (best && best.s >= 28) return best;
      }
      return scored.filter((x) => !usedIds.has(x.c.providerAssetId)).sort((a, b) => b.s - a.s)[0] ?? null;
    };

    const findStockPhoto = async (shot: ShotRow, vocab: string[]): Promise<Candidate | null> => {
      const scored: { c: Candidate; s: number }[] = [];
      const queries = [...shot.imageQueries, ...shot.videoQueries.slice(0, 2)];
      for (let i = 0; i < queries.length; i++) {
        try {
          for (const c of await searchPhotos(queries[i], orientation))
            scored.push({ c, s: scoreCandidate({ candidate: c, queryWords: vocab, shotDuration: shot.duration, orientation, usedIds, queryRank: i }) });
        } catch (e) { ctx.log(`photo search failed: ${(e as Error).message}`); }
        if (scored.length >= 10) break;
      }
      return scored.sort((a, b) => b.s - a.s)[0]?.c ?? null;
    };

    let aiFailures = 0;
    const makeAiImage = async (shot: ShotRow): Promise<(Candidate & { meta: Prisma.InputJsonValue }) | null> => {
      for (let attempt = 1; attempt <= 3; attempt++) {
        const r = await makeAiImageOnce(shot);
        if (r) return r;
        await new Promise((res) => setTimeout(res, 3000 * attempt));
      }
      aiFailures++;
      return null;
    };
    const makeAiImageOnce = async (shot: ShotRow): Promise<(Candidate & { meta: Prisma.InputJsonValue }) | null> => {
      const inShot = shot.characterNames.filter((n) => refs.has(n));
      const refUrls = [...inShot.map((n) => refs.get(n)!), ...userRefs.map(refSource)];
      const prompt = p.storyMode
        ? `${shot.visualDescription}${inShot.length ? ` ${inShot.map((n) => `${n} must look exactly like the reference image.`).join(" ")}` : ""}${refText} Style: ${styleText}. Consistent character design, ${preset?.textInImage && shot.onScreenText ? `the text "${shot.onScreenText}" drawn in the scene,` : "no text,"} no watermark, no speech bubbles.`
        : imagePrompt(shot.visualDescription, style, strategy?.tone ?? "cinematic", shot.onScreenText) + refText;
      try {
        let g;
        try {
          g = await generateAiImage(prompt, kieAspect(p.aspectRatio), refUrls, style);
        } catch (e) {
          // The image endpoint only accepts references uploaded to the provider; plain URLs (our own location
          // and character sheets) get "image_url must be an uploaded image". A still without references is
          // far better than no still at all (which becomes a title card in the film).
          if (refUrls.length && /uploaded image|image_url/i.test((e as Error).message)) {
            ctx.log(`  image refs rejected — retrying "${shot.visualDescription.slice(0, 40)}" without references`);
            g = await generateAiImage(prompt, kieAspect(p.aspectRatio), [], style);
          } else throw e;
        }
        const url = g.url, taskId = g.id, provider = g.provider, model = g.model;
        const creator = { kie: "Kie.ai (nano-banana)", abhibots: "AbhiBots (nano_banana_2)", snapgen: `SnapGen (${model})` }[provider];
        return {
          provider, providerAssetId: taskId, type: "IMAGE", url, previewUrl: url, creator,
          creatorUrl: { kie: "https://kie.ai", abhibots: "https://app.abhibots.com", snapgen: "https://snapgen.ai" }[provider], sourceUrl: { kie: "https://kie.ai", abhibots: "https://app.abhibots.com", snapgen: "https://snapgen.ai" }[provider],
          width: ratio.width, height: ratio.height, slugWords: [], meta: { prompt, generationId: taskId, model, references: inShot },
        } as Candidate & { meta: Prisma.InputJsonValue };
      } catch (e) {
        ctx.log(`AI image failed for "${shot.visualDescription.slice(0, 50)}": ${(e as Error).message}`);
        return null;
      }
    };

    const concurrency = mode === "stock_videos" ? env.STOCK_CONCURRENCY : aiVideo !== "none" ? env.VIDEO_CONCURRENCY : env.IMAGE_CONCURRENCY;
    ctx.log(`${aiVideo !== "none" ? requested : mode}: ${concurrency} shots in flight`);
    let inFlight = 0;
    /** Scene editor: a user-pinned source wins over search/generation. */
    const attachPinned = async (shot: ShotRow): Promise<boolean> => {
      const pin = (shot as ShotRow & { pinnedSource?: { type: string; id?: string; url?: string; path?: string; kind?: string; previewUrl?: string; width?: number; height?: number; duration?: number } | null }).pinnedSource;
      if (!pin) return false;
      if (pin.type === "pexels_video" || pin.type === "pexels_photo") {
        if (!pin.url || !pin.id) return false;
        await attach(shot, { provider: "pexels", providerAssetId: String(pin.id), type: pin.type === "pexels_video" ? "VIDEO" : "IMAGE", url: pin.url, previewUrl: pin.previewUrl ?? "", creator: "Pexels", creatorUrl: "https://www.pexels.com", sourceUrl: pin.url, width: pin.width ?? 1920, height: pin.height ?? 1080, duration: pin.duration, slugWords: [] });
        if (pin.type === "pexels_video") counts.videos++; else counts.images++;
        return true;
      }
      if (pin.type === "upload" && pin.path && fs.existsSync(pin.path)) {
        const isVideo = pin.kind === "video" || /\.(mp4|mov|webm|m4v)$/i.test(pin.path);
        const id = `upload-${crypto.createHash("md5").update(pin.path).digest("hex").slice(0, 12)}`;
        const meta = isVideo ? await probeMedia(pin.path).catch(() => null) : null;
        await attach(shot, { provider: "pexels", providerAssetId: id, type: isVideo ? "VIDEO" : "IMAGE", url: pin.url || publicUrl(pin.path), previewUrl: isVideo ? "" : (pin.url || publicUrl(pin.path)), creator: "You", creatorUrl: "", sourceUrl: "", width: meta?.width ?? 1920, height: meta?.height ?? 1080, duration: meta?.duration, slugWords: [] });
        // attach() downloads from url — for uploads the file is already local; make sure the local path is the upload itself
        const a = await prisma.mediaAsset.findUnique({ where: { provider_providerAssetId: { provider: "pexels", providerAssetId: id } } });
        if (a) await prisma.mediaAsset.update({ where: { id: a.id }, data: { localPath: pin.path, license: "Uploaded by the user", creator: "You" } });
        if (isVideo) counts.videos++; else counts.images++;
        return true;
      }
      return false;
    };

    await mapLimit(shots, concurrency, async (shot) => {
      if (shot.mediaAssetId) { counts.processed++; return; } // resume
      if (await attachPinned(shot)) { counts.processed++; return; }
      inFlight++;
      await bumpStats(p.id, { aiImagesInProgress: inFlight, shotsTotal: shots.length });
      const vocab = [...shot.videoQueries, ...shot.imageQueries, shot.visualDescription].join(" ").toLowerCase().split(/[^a-z0-9]+/).filter((w) => w.length > 2);
      try {
        let done = false;
        if (mode !== "ai_images") {
          const best = await findStockVideo(shot, vocab);
          const goodEnough = best && (mode === "stock_videos" ? best.s >= 12 : best.s >= 24);
          if (best && goodEnough) { await attach(shot, best.c); counts.videos++; done = true; }
        }
        if (!done && aiVideo === "all" && !env.VIDEO_FROM_IMAGE) {
          // pure text-to-video: no image step at all
          done = await animate(shot, null, {});
        }
        if (!done && mode !== "stock_videos") {
          const ai = await makeAiImage(shot);
          if (ai) {
            const wantVideo = aiVideo === "all" || (aiVideo === "hero" && shot.order === 0);
            const animated = wantVideo ? await animate(shot, ai.url, ai.meta as Record<string, unknown>) : false;
            if (!animated) {
              await attach(shot, ai); counts.aiImages++;
              // native speech: the clip failed, so speak this shot's line with TTS — the video must never be silent
              if (native && shot.dialogue) { try { await captureShotSpeech(shot); ctx.log(`native speech: TTS used for "${shot.dialogue.slice(0, 40)}"`); } catch (err) { ctx.log(`TTS fallback failed: ${(err as Error).message.slice(0, 120)}`); } }
            }
            done = true;
          }
        }
        if (!done && (mode !== "ai_images" || p.allowStockFallback)) {
          const photo = await findStockPhoto(shot, vocab);
          if (photo) { await attach(shot, photo); counts.images++; done = true; }
        }
        if (!done && mode !== "ai_images") {
          // last stock attempt: any video at all, even a weak match, beats a title card
          const weak = await findStockVideo(shot, vocab);
          if (weak) { await attach(shot, weak.c); counts.videos++; done = true; }
        }
        if (!done) { counts.missing++; ctx.log(`no media for shot "${shot.visualDescription.slice(0, 60)}" — title card`); }
      } catch (e) {
        counts.missing++;
        ctx.log(`media failed for shot ${shot.id}: ${(e as Error).message}`);
      }
      counts.processed++;
      inFlight--;
      await bumpStats(p.id, { videosFound: counts.videos, imagesFound: counts.images, aiImages: counts.aiImages, aiVideos: counts.aiVideos, aiImageFailures: aiFailures, shotsWithoutMedia: counts.missing, aiImagesInProgress: inFlight, shotsProcessed: counts.processed });
      await ctx.report(Math.round((counts.processed / shots.length) * 100), `${counts.processed}/${shots.length}`);
    });

    ctx.log(`media done (${requested}): ${counts.videos} stock videos, ${counts.aiVideos} AI videos, ${counts.aiImages} AI images, ${counts.images} photos, ${counts.missing} title cards`);
  },
};
