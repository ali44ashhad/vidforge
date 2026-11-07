import { prisma } from "@vidforge/db";
import { requireUser } from "@/lib/auth";

/** Throws a 404 response unless the current user owns the project (admins see everything). */
export async function assertOwner(id: string) {
  const user = await requireUser();
  const p = await prisma.project.findUnique({ where: { id }, select: { userId: true } });
  if (!p || (p.userId !== user.id && user.role !== "ADMIN")) throw new Response(JSON.stringify({ error: "Not found" }), { status: 404, headers: { "Content-Type": "application/json" } });
  return user;
}
