import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return json({ ok: true, db: "connected" });
  } catch (e) {
    return json({ ok: false, db: "error", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
}
