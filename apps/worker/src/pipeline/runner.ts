import { prisma, type Project } from "@vidforge/db";
import { sendEmail, emails } from "../services/email";
import { settleProject } from "../services/credits";
import { PIPELINE_STAGES } from "@vidforge/shared";
import { STAGES } from "./stages";
import { log } from "../lib/log";

type Checkpoint = { completedStages: string[] };

export class PauseRequested extends Error { constructor() { super("paused by user"); } }

async function pauseRequested(projectId: string): Promise<boolean> {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { pauseRequested: true } });
  return !!p?.pauseRequested;
}

function readCheckpoint(project: Project): Checkpoint {
  const cp = (project.checkpoint as Checkpoint | null) ?? { completedStages: [] };
  return { completedStages: cp.completedStages ?? [] };
}

/**
 * Runs all pipeline stages for a project, skipping stages already completed
 * (so a retry resumes where it crashed). Overall progress = stages done / total.
 */
/**
 * Keeps the claim alive while a project runs. The poller treats a lock older than STALE_LOCK_MS (30 min)
 * as a dead worker and re-claims the project — but clip generation on a long film and a 1080p final encode
 * both take longer than that, so without a heartbeat the SAME worker started a second copy of the project:
 * duplicate shot loops, duplicate renders, attempts burned. Refreshing lockedAt every 5 minutes fixes it.
 */
function startLockHeartbeat(projectId: string): () => void {
  const t = setInterval(() => {
    prisma.project.updateMany({ where: { id: projectId, lockedAt: { not: null } }, data: { lockedAt: new Date() } })
      .catch((e) => log(projectId, `lock heartbeat failed: ${(e as Error).message.slice(0, 80)}`));
  }, 5 * 60 * 1000);
  return () => clearInterval(t);
}

export async function runPipeline(projectId: string): Promise<void> {
  const stopHeartbeat = startLockHeartbeat(projectId);
  try { return await runPipelineInner(projectId); } finally { stopHeartbeat(); }
}

async function runPipelineInner(projectId: string): Promise<void> {
  let project = await prisma.project.findUniqueOrThrow({ where: { id: projectId } });
  const checkpoint = readCheckpoint(project);
  const total = PIPELINE_STAGES.length;

  for (let i = 0; i < STAGES.length; i++) {
    const stage = STAGES[i];
    if (!stage.alwaysRun && checkpoint.completedStages.includes(stage.name)) {
      log(projectId, `skip ${stage.name} (already done)`);
      continue;
    }

    if (await pauseRequested(projectId)) throw new PauseRequested();
    const base = Math.round((i / total) * 100);
    const span = Math.round(100 / total);

    project = await prisma.project.update({
      where: { id: projectId },
      data: { status: stage.name, currentStage: stage.name, progress: base, error: null },
    });
    log(projectId, `▶ ${stage.name}`);

    await stage.run({
      project,
      log: (m, extra) => log(projectId, `${stage.name}: ${m}`, extra),
      report: async (pct, note) => {
        const progress = Math.min(99, base + Math.round((span * Math.max(0, Math.min(100, pct))) / 100));
        const row = await prisma.project.update({
          where: { id: projectId },
          data: { progress, currentStage: note ? `${stage.name}:${note}` : stage.name },
          select: { pauseRequested: true },
        });
        if (row.pauseRequested) throw new PauseRequested();
      },
    });

    checkpoint.completedStages.push(stage.name);
    project = await prisma.project.update({
      where: { id: projectId },
      data: { checkpoint, progress: Math.round(((i + 1) / total) * 100) },
    });
  }

  const done = await prisma.project.update({
    where: { id: projectId },
    data: { status: "COMPLETED", currentStage: null, progress: 100, lockedAt: null },
  });
  try {
    const s = await settleProject(done);
    if (s.charged) log(projectId, `credits: charged ${s.charged}, released ${s.released} of ${done.creditsReserved} reserved`);
  } catch (e) { log(projectId, `credit settlement failed: ${(e as Error).message}`); }
  try {
    const u = await prisma.user.findUnique({ where: { id: done.userId }, select: { email: true } });
    if (u?.email) {
      const st = (done.stats as Record<string, unknown>) ?? {};
      const attention = Number(st.shotsWithoutMedia) > 0 || Number(st.aiImageFailures) > 0;
      const m = emails.ready(done.title, `${process.env.APP_URL || "https://app.y2ube.io"}/projects/${done.id}`, attention);
      if (await sendEmail(u.email, m.subject, m.html)) log(projectId, "email: video-ready sent");
    }
  } catch (e) { log(projectId, `email failed: ${(e as Error).message}`); }
  log(projectId, "✓ COMPLETED");
}
