/**
 * Lists every voice segment of a project with its measured length vs. what its text implies,
 * flags implausible ones, and with --fix deletes them so "Resume from last step" regenerates only those.
 * Run: npm run voice:audit -w apps/worker -- <projectId> [--fix]
 */
import "../env";
import { prisma } from "@vidforge/db";
import { probeDuration } from "../lib/media";

(async () => {
  const [projectId, flag] = process.argv.slice(2);
  if (!projectId) { console.log("usage: npm run voice:audit -w apps/worker -- <projectId> [--fix]"); process.exit(1); }
  const segs = await prisma.voiceSegment.findMany({ where: { projectId }, orderBy: { order: "asc" } });
  if (!segs.length) { console.log("no voice segments for this project"); process.exit(0); }
  const bad: string[] = [];
  for (const s of segs) {
    const chars = s.text.replace(/\s+/g, " ").length;
    const min = Math.max(0.8, chars / 35), max = chars / 5 + 5;
    const measured = s.localPath ? await probeDuration(s.localPath).catch(() => 0) : 0;
    const ok = measured >= min && measured <= max;
    if (!ok) bad.push(s.id);
    console.log(`${ok ? "✓" : "✗"} segment ${String(s.order).padStart(3)}  ${measured.toFixed(1).padStart(6)}s  db=${s.duration.toFixed(1).padStart(6)}s  ${chars} chars  expected ${min.toFixed(1)}-${max.toFixed(1)}s  ${s.provider}`);
  }
  console.log(`\n${segs.length} segments, ${bad.length} implausible`);
  if (bad.length && flag === "--fix") {
    await prisma.voiceSegment.deleteMany({ where: { id: { in: bad } } });
    await prisma.project.update({
      where: { id: projectId },
      data: { status: "QUEUED", error: null, lockedAt: null, attempts: 0, progress: 0,
        checkpoint: { completedStages: ["SCRIPTING", "STORYBOARDING"] } },
    });
    console.log(`deleted ${bad.length} segments and re-queued the project from VOICE_GENERATION (worker will regenerate only those, then re-render)`);
  } else if (bad.length) {
    console.log("run again with --fix to regenerate the flagged segments");
  }
  process.exit(0);
})();
