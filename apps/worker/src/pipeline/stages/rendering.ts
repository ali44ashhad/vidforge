import { prisma } from "@vidforge/db";
import type { StageDefinition } from "../types";
import { loadTimeline } from "../timeline";
import { renderProject } from "../../services/render";
import { publicUrl } from "../../lib/storage";

/** RENDERING: FFmpeg pipeline → final.mp4. Tracked in a RenderJob row. */
export const rendering: StageDefinition = {
  alwaysRun: true,
  name: "RENDERING",
  async run(ctx) {
    const p = ctx.project;
    const tl = loadTimeline(p.id);
    const job = await prisma.renderJob.create({ data: { projectId: p.id, status: "RUNNING", startedAt: new Date() } });
    let lastPct = -1;
    try {
      const out = await renderProject(tl, async (pct, note) => {
        if (pct === lastPct) return;
        lastPct = pct;
        await prisma.renderJob.update({ where: { id: job.id }, data: { progress: pct, currentStage: note } });
        await ctx.report(pct, note);
      }, (m) => ctx.log(m));
      await prisma.renderJob.update({ where: { id: job.id }, data: { status: "COMPLETED", progress: 100, outputUrl: publicUrl(out.finalPath), completedAt: new Date() } });
      await prisma.project.update({
        where: { id: p.id },
        data: {
          finalVideoUrl: publicUrl(out.finalPath), thumbnailUrl: publicUrl(out.thumbPath), captionsUrl: publicUrl(out.srtPath),
          actualDuration: out.duration, fileSize: out.fileSize, width: tl.width, height: tl.height,
        },
      });
      ctx.log(`render done: ${out.duration.toFixed(1)}s, ${(out.fileSize / 1e6).toFixed(1)} MB`);
    } catch (e) {
      await prisma.renderJob.update({ where: { id: job.id }, data: { status: "FAILED", error: (e as Error).message.slice(0, 2000) } });
      throw e;
    }
  },
};
