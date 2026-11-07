import { json } from "@/lib/api";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";
/** Public merged catalog (templates, plans) for the client UI. */
export async function GET() { const c = await catalog(); return json({ templates: c.templates, plans: c.plans }); }
