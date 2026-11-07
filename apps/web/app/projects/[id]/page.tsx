import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import ProjectStatus from "@/components/ProjectStatus";

export const dynamic = "force-dynamic";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getUser();
  const yt = user ? await prisma.user.findUnique({ where: { id: user.id }, select: { youtube: true } }) : null;
  return <ProjectStatus id={id} youtubeConnected={!!yt?.youtube} />;
}
