import { getUser } from "@/lib/auth";
import AcademyGrid from "@/components/AcademyGrid";
import { getAssets } from "@/lib/assets";
export const dynamic = "force-dynamic";
export default async function AcademyPage() { const u = await getUser(); const A = getAssets(); return <AcademyGrid images={A.academy} admin={u?.role === "ADMIN"} />; }
