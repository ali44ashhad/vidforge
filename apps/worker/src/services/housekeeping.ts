import fs from "node:fs";
import path from "node:path";
import { prisma } from "@vidforge/db";
import { env } from "../env";
import { log } from "../lib/log";
import { sendEmail } from "./email";

const DAY = 86400e3;
const dirSize = (d: string): number => { try { return fs.readdirSync(d, { withFileTypes: true }).reduce((a, e) => a + (e.isDirectory() ? dirSize(path.join(d, e.name)) : fs.statSync(path.join(d, e.name)).size), 0); } catch { return 0; } };

/**
 * Nightly housekeeping:
 *  - render/ intermediates (per-shot and per-scene clips) older than RENDER_KEEP_DAYS → removed (final.mp4, thumbnails, assets stay; a re-render rebuilds them)
 *  - storage folders whose project no longer exists → removed
 *  - batches/*.zip older than 2 days → removed
 *  - disk check: warn by email (ADMIN_EMAIL) when free space < DISK_ALERT_FREE_GB
 */
export async function housekeeping(): Promise<void> {
  const keepDays = Number(process.env.RENDER_KEEP_DAYS || 3);
  const root = path.join(env.STORAGE_DIR, "projects");
  if (!fs.existsSync(root)) return;
  let freed = 0, removedProjects = 0, removedRenders = 0;
  const ids = fs.readdirSync(root).filter((n) => /^[a-z0-9]+$/i.test(n));
  const existing = new Set((await prisma.project.findMany({ where: { id: { in: ids } }, select: { id: true } })).map((p) => p.id));
  for (const id of ids) {
    const dir = path.join(root, id);
    if (!existing.has(id) && id !== "selftest") { freed += dirSize(dir); fs.rmSync(dir, { recursive: true, force: true }); removedProjects++; continue; }
    const render = path.join(dir, "render");
    if (fs.existsSync(render)) {
      for (const f of fs.readdirSync(render)) {
        const p = path.join(render, f);
        try { if (Date.now() - fs.statSync(p).mtimeMs > keepDays * DAY) { freed += dirSize(p); fs.rmSync(p, { recursive: true, force: true }); removedRenders++; } } catch { /* ignore */ }
      }
    }
  }
  const batches = path.join(env.STORAGE_DIR, "batches");
  if (fs.existsSync(batches)) for (const f of fs.readdirSync(batches)) { const p = path.join(batches, f); try { if (Date.now() - fs.statSync(p).mtimeMs > 2 * DAY) { freed += fs.statSync(p).size; fs.rmSync(p, { recursive: true, force: true }); } } catch { /* ignore */ } }
  log("housekeeping", `removed ${removedProjects} orphaned project folders, ${removedRenders} old render folders — freed ${(freed / 1e9).toFixed(2)} GB`);

  // disk alert
  try {
    const st = fs.statfsSync(env.STORAGE_DIR);
    const freeGb = (st.bavail * st.bsize) / 1e9, totalGb = (st.blocks * st.bsize) / 1e9;
    const threshold = Number(process.env.DISK_ALERT_FREE_GB || 15);
    log("housekeeping", `disk: ${freeGb.toFixed(1)} GB free of ${totalGb.toFixed(0)} GB`);
    if (freeGb < threshold && process.env.ADMIN_EMAIL) await sendEmail(process.env.ADMIN_EMAIL, `Y2ube worker: low disk (${freeGb.toFixed(1)} GB free)`, `<p>The worker's storage has ${freeGb.toFixed(1)} GB free of ${totalGb.toFixed(0)} GB. Lower RENDER_KEEP_DAYS or add disk.</p>`);
  } catch { /* statfs unsupported */ }
}

/** Runs housekeeping now and then every 24 h. */
export function scheduleHousekeeping() {
  setTimeout(() => housekeeping().catch((e) => log("housekeeping", `failed: ${(e as Error).message}`)), 60_000);
  setInterval(() => housekeeping().catch((e) => log("housekeeping", `failed: ${(e as Error).message}`)), 24 * 3600e3);
}
