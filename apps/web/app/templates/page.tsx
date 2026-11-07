import { catalog } from "@/lib/config";
import { getAssets } from "@/lib/assets";
import TemplatesGrid from "@/components/TemplatesGrid";
export const dynamic = "force-dynamic";
export default async function TemplatesPage() {
  const { templates } = await catalog(); const A = getAssets();
  return <TemplatesGrid templates={templates.map((t) => ({ id: t.id, name: t.name, group: t.group, description: t.description, duration: t.defaults.durationSeconds ?? (t.pacing === "energetic" ? 60 : 300), aspect: t.defaults.aspectRatio ?? "R16_9", style: t.defaults.style }))} images={A.templates} />;
}
