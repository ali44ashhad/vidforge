import { json } from "@/lib/api";
import { getUser } from "@/lib/auth";
import { estimateCredits } from "@vidforge/shared";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const { rates } = await catalog();
  const est = estimateCredits({
    targetDuration: Number(b.targetDuration ?? 60), visualSource: String(b.visualSource ?? "mixed"), aiVideoResolution: String(b.aiVideoResolution ?? "720p"),
    musicEnabled: b.musicEnabled !== false, voiceEnabled: b.voiceEnabled !== false, storyMode: b.narrationMode !== undefined && b.narrationMode !== "narrator",
    characterCount: Array.isArray(b.characters) ? b.characters.length : Number(b.characterCount ?? 0),
  }, rates);
  const user = await getUser();
  return json({ estimate: est, balance: user?.credits ?? null, enough: user ? user.credits >= est.reserve : null });
}
