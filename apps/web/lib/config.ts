import { prisma } from "@vidforge/db";
import { mergeTemplates, mergePlans, mergeRates, type OverrideMap } from "@vidforge/shared";

let cache: { at: number; ov: OverrideMap } | null = null;
export async function loadOverrides(force = false): Promise<OverrideMap> {
  if (!force && cache && Date.now() - cache.at < 30_000) return cache.ov;
  const rows = await prisma.configOverride.findMany().catch(() => []);
  const ov: OverrideMap = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  cache = { at: Date.now(), ov };
  return ov;
}
export async function catalog() { const ov = await loadOverrides(); return { templates: mergeTemplates(ov), plans: mergePlans(ov), rates: mergeRates(ov), overrides: ov }; }
