import type { StageDefinition } from "../types";
import { bumpStats } from "../stats";

/** In-flight background music jobs started early (during FETCHING_MEDIA) so music overlaps the visuals. */
export const musicInFlight = new Map<string, Promise<void>>();

export function startMusicEarly(ctx: Parameters<StageDefinition["run"]>[0]) {
  if (musicInFlight.has(ctx.project.id)) return;
  const quiet = { ...ctx, report: async () => {}, log: (m: string, extra?: unknown) => ctx.log(`(music, background) ${m}`, extra) };
  const job = musicGeneration.run(quiet).catch((e) => ctx.log(`background music failed: ${(e as Error).message}`)).finally(() => musicInFlight.delete(ctx.project.id));
  musicInFlight.set(ctx.project.id, job);
}

/** Kie background music is disabled. Videos render with the voiceover only. */
export const musicGeneration: StageDefinition = {
  name: "MUSIC_GENERATION",
  async run(ctx) {
    ctx.log("background music skipped");
    await bumpStats(ctx.project.id, { musicTracks: 0 });
  },
};
