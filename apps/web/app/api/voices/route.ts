import { prisma } from "@vidforge/db";
import { json } from "@/lib/api";

export const dynamic = "force-dynamic";

/** Voices synced by the worker from ElevenLabs (empty until the worker has run once with a key). */
export async function GET() {
  const voices = await prisma.voice.findMany({ orderBy: [{ category: "asc" }, { name: "asc" }] });
  return json({ voices });
}
