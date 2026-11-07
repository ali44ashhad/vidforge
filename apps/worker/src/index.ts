import "./env";
import { syncCommunityVoices } from "./services/voice/community";
import { scheduleHousekeeping } from "./services/housekeeping";
import { prisma } from "@vidforge/db";
import { log } from "./lib/log";
import { startFileServer } from "./server";
import { startPoller } from "./poller";
import { assertFfmpegInstalled } from "./lib/media";
import { syncVoicesToDb } from "./services/voice";
import { env } from "./env";

async function main() {
  await prisma.$queryRaw`SELECT 1`;
  log("worker", "database connection OK");
  // A restart means any project still "locked" by the old process is orphaned (single-worker setups).
  // Release them so they are claimed immediately instead of after the 30-minute stale-lock timeout.
  if (process.env.WORKER_RELEASE_LOCKS_ON_START !== "false") {
    const orphaned = await prisma.project.updateMany({
      where: { lockedAt: { not: null }, status: { notIn: ["COMPLETED", "FAILED", "DRAFT", "PAUSED"] } },
      data: { lockedAt: null, status: "QUEUED" },
    });
    if (orphaned.count) log("worker", `released ${orphaned.count} orphaned project lock(s) — they resume from their checkpoints`);
  }
  await assertFfmpegInstalled().then(() => log("worker", "ffmpeg OK (all required filters present)")).catch((e) => log("worker", `WARNING: ${e.message}`));
  startFileServer();
  if (env.ELEVENLABS_API_KEY || env.ABHIBOTS_API_KEY) {
    const sync = () => syncVoicesToDb(prisma as never).then((n) => log("voices", `synced ${n} voices from ${env.VOICE_PROVIDER}`)).catch((e) => log("voices", `sync failed: ${e.message}`));
    void sync();
    setInterval(sync, 6 * 3600 * 1000);
  }
  scheduleHousekeeping();
  // community voice library: first sync 2 min after boot, then nightly
  setTimeout(() => syncCommunityVoices().catch(() => {}), 120_000); setInterval(() => syncCommunityVoices().catch(() => {}), 24 * 3600e3);
  await startPoller();
}

main().catch((err) => {
  console.error("worker crashed:", err);
  process.exit(1);
});
