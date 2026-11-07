import { prisma } from "@vidforge/db";
import { json, badRequest } from "@/lib/api";
import { requireAdmin, withAuth } from "@/lib/adminApi";
import { postLedger } from "@/lib/credits";
import { PLANS } from "@vidforge/shared";
export const dynamic = "force-dynamic";

/** Admin actions on a user: grant | plan | suspend | unsuspend | role */
export const POST = withAuth(async (req: Request, ctx: { params: Promise<{ id: string }> }) => {
  const admin = await requireAdmin();
  const { id } = await ctx.params;
  const b = (await req.json().catch(() => ({}))) as { action?: string; amount?: number; reason?: string; plan?: string; role?: string };
  const u = await prisma.user.findUnique({ where: { id } });
  if (!u) return badRequest("User not found");
  switch (b.action) {
    case "grant": {
      const amount = Math.round(Number(b.amount));
      if (!Number.isFinite(amount) || amount === 0) return badRequest("Amount required");
      await postLedger(id, amount > 0 ? "GRANT" : "ADJUST", amount, { reason: b.reason || "Admin adjustment", actorId: admin.id });
      return json({ ok: true });
    }
    case "plan": {
      const plan = PLANS.find((p) => p.id === b.plan);
      if (!plan) return badRequest("Unknown plan");
      const expires = new Date(); expires.setDate(expires.getDate() + 30);
      await prisma.user.update({ where: { id }, data: { plan: plan.id, planExpiresAt: plan.monthly ? expires : null } });
      return json({ ok: true });
    }
    case "suspend": await prisma.user.update({ where: { id }, data: { suspended: true } }); return json({ ok: true });
    case "unsuspend": await prisma.user.update({ where: { id }, data: { suspended: false } }); return json({ ok: true });
    case "role":
      if (id === admin.id) return badRequest("You can't change your own role");
      await prisma.user.update({ where: { id }, data: { role: b.role === "ADMIN" ? "ADMIN" : "USER" } }); return json({ ok: true });
    default: return badRequest("Unknown action");
  }
});
