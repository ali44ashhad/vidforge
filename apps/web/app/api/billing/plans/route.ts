import { json } from "@/lib/api";
import { catalog } from "@/lib/config";
export const dynamic = "force-dynamic";
export async function GET() { return json({ plans: (await catalog()).plans, provider: "stripe" }); }
