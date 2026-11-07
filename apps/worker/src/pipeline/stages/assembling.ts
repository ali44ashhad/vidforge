import type { StageDefinition } from "../types";
import { buildTimeline } from "../timeline";
import { recalculateTimeline } from "../timing";
import { bumpStats } from "../stats";

/** ASSEMBLING: build + validate the timeline from real timings and downloaded media. */
export const assembling: StageDefinition = {
  alwaysRun: true,
  name: "ASSEMBLING",
  async run(ctx) {
    // always derive timing from the voice segments that exist right now
    await recalculateTimeline(ctx.project.id);
    const tl = await buildTimeline(ctx.project.id);
    for (const w of tl.warnings) ctx.log(`warning: ${w}`);
    const titleCards = tl.scenes.flatMap((s) => s.shots).filter((s) => s.kind === "title").length;
    await bumpStats(ctx.project.id, { timelineShots: tl.scenes.flatMap((s) => s.shots).length, titleCards });
    ctx.log(`timeline OK: ${tl.scenes.length} scenes, ${tl.totalDuration.toFixed(1)}s, music ${tl.music ? "yes" : "no"}`);
    await ctx.report(100);
  },
};
