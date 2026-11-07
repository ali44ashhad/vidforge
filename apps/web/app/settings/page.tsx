import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import { catalog } from "@/lib/config";
import SettingsPage from "@/components/settings/SettingsPage";

export const dynamic = "force-dynamic";

export default async function Settings() {
  const user = await getUser();
  if (!user) return null;
  const [full, { plans }] = await Promise.all([prisma.user.findUnique({ where: { id: user.id }, select: { youtube: true } }), catalog()]);
  const yt = full?.youtube as { channelTitle: string; thumbnail?: string; connectedAt: string } | null;
  return <SettingsPage user={user} youtube={yt} planName={plans.find((p) => p.id === user.plan)?.name ?? "Free"} apiAllowed={["pro", "unlimited"].includes(user.plan) || user.role === "ADMIN"} />;
}
