/**
 * Assigns finished videos to the homepage slots (Project.showcaseSlot) by matching titles — the same effect as
 * Admin → Projects → "Homepage", but automatic. Re-run any time; the newest matching COMPLETED video wins.
 *   npm run marketing:feature -w apps/worker
 *   npm run marketing:feature -w apps/worker -- showreel=cmt…   (force a specific project into a slot)
 */
import { prisma } from "@vidforge/db";

const MATCH: Record<string, RegExp> = {
  demo: /one idea into|y2ube in 90|90.second/i, showreel: /showreel/i, niche: /channel direction|channel niche|profitable/i, "first-video": /first (youtube )?video/i,
  thumbnails: /thumbnail/i, publish: /publish/i, retention: /watch time|retention/i, monetize: /partner program|monetiz/i,
};

(async () => {
  const forced = Object.fromEntries(process.argv.slice(2).filter((a) => a.includes("=")).map((a) => a.split("=") as [string, string]));
  const done = await prisma.project.findMany({ where: { status: "COMPLETED", finalVideoUrl: { not: null } }, orderBy: { createdAt: "desc" }, select: { id: true, title: true, showcaseSlot: true } });
  for (const slot of Object.keys(MATCH)) {
    const pick = forced[slot] ? done.find((p) => p.id === forced[slot]) : done.find((p) => MATCH[slot].test(p.title) && (slot !== "demo" || !/showreel/i.test(p.title)));
    if (!pick) { console.log(`${slot.padEnd(12)} -> no finished video matches`); continue; }
    await prisma.project.updateMany({ where: { showcaseSlot: slot, id: { not: pick.id } }, data: { showcaseSlot: null } });
    await prisma.project.update({ where: { id: pick.id }, data: { showcaseSlot: slot } });
    console.log(`${slot.padEnd(12)} -> ${pick.id}  ${pick.title.slice(0, 60)}`);
  }
  console.log("\nHomepage updated — reload app.y2ube.io (no deploy needed).");
  process.exit(0);
})();
