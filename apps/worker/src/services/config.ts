import { prisma } from "@vidforge/db";
import { mergeTemplates, mergeRates, voiceDefault as vd, type OverrideMap, type VideoTemplate } from "@vidforge/shared";

let cache: { at: number; ov: OverrideMap } | null = null;
export async function overrides(): Promise<OverrideMap> {
  if (cache && Date.now() - cache.at < 60_000) return cache.ov;
  const rows = await prisma.configOverride.findMany().catch(() => []);
  cache = { at: Date.now(), ov: Object.fromEntries(rows.map((r) => [r.key, r.value])) };
  return cache.ov;
}
export async function templateFor(id: string): Promise<VideoTemplate | null> {
  const ov = await overrides();
  return mergeTemplates(ov).find((t) => t.id === id) ?? null;
}
export async function rates() { return mergeRates(await overrides()); }
export async function voiceDefaultFor(language: string) { return vd(await overrides(), language); }
