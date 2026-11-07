import { prisma, Prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
import { loadOverrides } from "@/lib/config";
export const dynamic = "force-dynamic";

export const GET = withAuth(async () => { await requireAdmin(); return json({ overrides: await loadOverrides(true) }); });

/** PUT { key, value } — value null deletes the override (back to code default). */
export const PUT = withAuth(async (req: Request) => {
  const admin = await requireAdmin();
  const { key, value } = (await req.json().catch(() => ({}))) as { key?: string; value?: unknown };
  if (!key || !/^(template:|plan:|voice-default:|credit-rates$)/.test(key)) return badRequest("Unknown key");
  if (value === null || value === undefined) await prisma.configOverride.deleteMany({ where: { key } });
  else await prisma.configOverride.upsert({ where: { key }, create: { key, value: value as Prisma.InputJsonValue, updatedBy: admin.id }, update: { value: value as Prisma.InputJsonValue, updatedBy: admin.id } });
  await loadOverrides(true);
  return json({ ok: true });
});
