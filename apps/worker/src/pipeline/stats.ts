import { prisma, type Prisma } from "@vidforge/db";

/** Merge counters into project.stats (shown live on the generation screen). */
export async function bumpStats(projectId: string, patch: Record<string, number | string>) {
  const p = await prisma.project.findUnique({ where: { id: projectId }, select: { stats: true } });
  const stats = { ...((p?.stats as Record<string, unknown>) ?? {}), ...patch };
  await prisma.project.update({ where: { id: projectId }, data: { stats: stats as Prisma.InputJsonValue } });
}
