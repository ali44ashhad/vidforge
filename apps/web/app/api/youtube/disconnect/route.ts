import { prisma, Prisma } from "@vidforge/db";
import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
export const dynamic = "force-dynamic";
export const POST = withAuth(async () => { const u = await requireUser(); await prisma.user.update({ where: { id: u.id }, data: { youtube: Prisma.DbNull } }); return json({ ok: true }); });
