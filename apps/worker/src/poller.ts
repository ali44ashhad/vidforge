import { prisma } from "@vidforge/db";
import { sendEmail, emails } from "./services/email";
import { refundProject } from "./services/credits";
import { env } from "./env";
import { log, sleep } from "./lib/log";
import { runPipeline, PauseRequested } from "./pipeline/runner";

const MAX_ATTEMPTS = 3;
const POLL_MS = 3000;
/** Max simultaneous projects per user (fairness under load). */
const USER_MAX_INFLIGHT = Number(process.env.USER_MAX_INFLIGHT || 3);
/** A lock older than this is considered dead (worker crashed) and can be re-claimed. */
const STALE_LOCK_MS = 30 * 60 * 1000;

/**
 * Atomically claims ONE queued project using Postgres row locking, so several
 * workers can run in parallel without picking the same project.
 */
async function claimNext(): Promise<string | null> {
  const rows = await prisma.$queryRaw<{ id: string }[]>`
    UPDATE "Project"
    SET "lockedAt" = NOW(), "attempts" = "attempts" + 1
    WHERE id = (
      SELECT p.id FROM "Project" p
      JOIN "User" u ON u.id = p."userId"
      WHERE (
             (p."status" = 'QUEUED' AND p."lockedAt" IS NULL)
          OR (p."status" NOT IN ('COMPLETED','FAILED','DRAFT','PAUSED')
              AND p."lockedAt" IS NOT NULL
              AND p."lockedAt" < NOW() - (${STALE_LOCK_MS} || ' milliseconds')::interval)
        )
        -- fairness: a user may have at most USER_MAX_INFLIGHT projects running at once (bulk can't starve others)
        AND (SELECT COUNT(*) FROM "Project" r WHERE r."userId" = p."userId" AND r."lockedAt" IS NOT NULL
             AND r."status" NOT IN ('COMPLETED','FAILED','DRAFT','PAUSED','QUEUED')) < ${USER_MAX_INFLIGHT}
      ORDER BY
        -- priority: paid plans first, single videos before bulk batches, then oldest
        CASE u."plan" WHEN 'unlimited' THEN 0 WHEN 'pro' THEN 1 WHEN 'creator' THEN 2 WHEN 'starter' THEN 3 ELSE 4 END ASC,
        CASE WHEN p."batchId" IS NULL THEN 0 ELSE 1 END ASC,
        p."createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING id
  `;
  return rows[0]?.id ?? null;
}

async function processOne(projectId: string) {
  try {
    await runPipeline(projectId);
  } catch (err) {
    if (err instanceof PauseRequested) {
      log(projectId, "⏸ paused (progress kept; resume from the project page)");
      await prisma.project.update({ where: { id: projectId }, data: { status: "PAUSED", pauseRequested: false, lockedAt: null, attempts: 0 } });
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    const project = await prisma.project.findUnique({ where: { id: projectId } });
    const attempts = project?.attempts ?? MAX_ATTEMPTS;
    const giveUp = attempts >= MAX_ATTEMPTS;
    log(projectId, `✗ failed (attempt ${attempts}/${MAX_ATTEMPTS}): ${message}`);
    await prisma.project.update({
      where: { id: projectId },
      data: giveUp
        ? { status: "FAILED", error: message, lockedAt: null }
        : { status: "QUEUED", error: message, lockedAt: null }, // requeue -> resumes from checkpoint
    });
    if (giveUp && project) {
      try { const r = await refundProject(project); if (r) log(projectId, `credits: refunded ${r}`); } catch (e) { log(projectId, `refund failed: ${(e as Error).message}`); }
      try {
        const u = await prisma.user.findUnique({ where: { id: project.userId }, select: { email: true } });
        if (u?.email) { const m = emails.failed(project.title, `${process.env.APP_URL || "https://app.y2ube.io"}/projects/${project.id}`, message); await sendEmail(u.email, m.subject, m.html); }
      } catch { /* optional */ }
    }
  }
}

export const workerState = { active: 0, startedAt: Date.now() };

export async function startPoller() {
  log("poller", `polling every ${POLL_MS}ms, concurrency ${env.WORKER_CONCURRENCY}`);
  let active = 0;
  setInterval(() => { workerState.active = active; }, 1000);
  // simple loop: claim while we have free slots
  for (;;) {
    if (active < env.WORKER_CONCURRENCY) {
      const id = await claimNext().catch((e) => {
        log("poller", `claim error: ${e instanceof Error ? e.message : e}`);
        return null;
      });
      if (id) {
        active++;
        log("poller", `claimed project ${id}`);
        processOne(id).finally(() => active--);
        continue; // try to fill remaining slots immediately
      }
    }
    await sleep(POLL_MS);
  }
}
