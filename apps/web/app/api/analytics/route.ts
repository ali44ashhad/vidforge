import { json } from "@/lib/api";
import { requireUser, withAuth } from "@/lib/auth";
import { youtubeOverview } from "@/lib/analytics";
export const dynamic = "force-dynamic";
export const GET = withAuth(async (req: Request) => {
  const u = await requireUser();
  const days = Math.min(365, Math.max(7, Number(new URL(req.url).searchParams.get("days") ?? 28)));
  return json(await youtubeOverview(u.id, days));
});
