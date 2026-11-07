import { prisma } from "@vidforge/db";
import { shotSecondsFor } from "@vidforge/shared";
import type { Strategy, CharacterSpec } from "@vidforge/shared";
import type { StageDefinition } from "../types";
import { planChapterShots, createMusicPrompt } from "../../services/deepseek";
import { mapLimit } from "../../lib/http";
import { bumpStats } from "../stats";

/** STORYBOARDING: DeepSeek plans visual shots for every scene (chapters processed 3 at a time). */
export const storyboarding: StageDefinition = {
  name: "STORYBOARDING",
  async run(ctx) {
    const p = ctx.project;
    const strategy = p.strategy as Strategy & { characters?: CharacterSpec[] };
    const characters = p.storyMode ? strategy.characters ?? [] : undefined;
    const chapters = await prisma.chapter.findMany({
      where: { projectId: p.id }, orderBy: { order: "asc" }, include: { scenes: { orderBy: { order: "asc" } } },
    });
    if (!chapters.length) throw new Error("No chapters found — SCRIPTING must run first");
    // Short-form (or anything up to 90 s) is cut every 1.5-3 s: the director plans many more, much more specific shots
    const shotSeconds = shotSecondsFor(p.videoType, p.targetDuration, p.visualSource);
    if (shotSeconds) ctx.log(`short-form pacing: shots of ${shotSeconds.min}-${shotSeconds.max}s (~${Math.round(p.targetDuration / ((shotSeconds.min + shotSeconds.max) / 2))} shots for ${p.targetDuration}s)`);

    let done = 0, totalShots = 0;
    const moods: string[] = [];

    await mapLimit(chapters, 3, async (ch) => {
      const plan = await planChapterShots({
        title: strategy.title, chapterTitle: ch.title, tone: strategy.tone, pacing: shotSeconds ? "energetic" : strategy.pacing,
        aspectRatio: p.aspectRatio, scenes: ch.scenes.map((s) => s.narration), voiceSpeed: p.voiceSpeed,
        characters, storyStyle: p.imageStyle || "Storybook illustration",
        // AI video: plan whole clips (8 s Veo / 10 s Omni) so every generated clip is fully used
        maxShotSeconds: /ai_video/.test(p.visualSource) ? (/(omni)/.test(process.env.SNAPGEN_VIDEO_MODEL || "") ? 10 : 8) : undefined,
        wholeClips: /ai_video/.test(p.visualSource),
        shotSeconds,
        language: p.language,
        noVoice: !p.voiceEnabled,
        styleName: p.imageStyle || undefined,
        presenterMode: p.videoType === "Spokesperson Ad",
        nativeSpeech: p.speechMode === "veo_native" ? { lines: ch.scenes.map((s) => ((s.lines as unknown as { speaker: string; text: string }[] | null) ?? [{ speaker: "narrator", text: s.narration }])) } : null,
      });
      moods[ch.order] = plan.musicMood;
      await prisma.chapter.update({ where: { id: ch.id }, data: { musicMood: plan.musicMood } });

      for (const scene of ch.scenes) {
        const planned = plan.scenes.find((s) => s.index === scene.order)?.shots
          ?? plan.scenes[scene.order]?.shots
          ?? [{ duration: 6, visualDescription: scene.narration.slice(0, 80), pexelsVideoQueries: [strategy.title.split(" ").slice(0, 2).join(" ")], pexelsImageQueries: [], transition: "cut", motion: "zoom_in", onScreenText: "", characters: [], dialogue: "" }];
        await prisma.shot.deleteMany({ where: { sceneId: scene.id } });
        await prisma.shot.createMany({
          data: planned.map((s, i) => ({
            sceneId: scene.id, order: i, duration: s.duration, visualDescription: s.visualDescription,
            videoQueries: s.pexelsVideoQueries, imageQueries: s.pexelsImageQueries,
            onScreenText: s.onScreenText || null, transition: s.transition, motion: s.motion,
            characterNames: (s.characters ?? []).filter((n) => characters?.some((c) => c.name === n)),
            dialogue: s.dialogue || null,
          })),
        });
        totalShots += planned.length;
      }
      done++;
      await bumpStats(p.id, { shots: totalShots });
      await ctx.report(Math.round((done / chapters.length) * 90), `chapter ${ch.order + 1}`);
      ctx.log(`chapter ${ch.order + 1} planned (${totalShots} shots so far)`);
    });

    const musicPrompt = await createMusicPrompt({
      title: strategy.title, tone: strategy.tone, audience: strategy.audience, minutes: Math.round(p.targetDuration / 60), moods, style: p.musicStyle,
    });
    await prisma.project.update({ where: { id: p.id }, data: { musicPrompt } });
    ctx.log(`storyboard done: ${totalShots} shots`);
  },
};
