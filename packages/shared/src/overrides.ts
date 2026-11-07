import { VIDEO_TEMPLATES, type VideoTemplate } from "./templates";
import { PLANS, CREDIT_RATES, type Plan } from "./credits";

export type OverrideMap = Record<string, unknown>;

/** Merge template overrides: { description?, playbook?, pacing?, active?: false, defaults?: Partial } */
export function mergeTemplates(ov: OverrideMap): VideoTemplate[] {
  return VIDEO_TEMPLATES.map((t) => {
    const o = ov[`template:${t.id}`] as Partial<VideoTemplate> & { active?: boolean } | undefined;
    if (!o) return t;
    return { ...t, ...(o.name ? { name: o.name } : {}), ...(o.description ? { description: o.description } : {}), ...(o.playbook ? { playbook: o.playbook } : {}), ...(o.pacing ? { pacing: o.pacing } : {}), defaults: { ...t.defaults, ...(o.defaults ?? {}) }, ...(o.active === false ? { hidden: true } : {}) } as VideoTemplate & { hidden?: boolean };
  }).filter((t) => !(t as { hidden?: boolean }).hidden);
}

/** Merge plan overrides: { name?, priceInr?, credits?, popular?, active?: false, features? } */
export function mergePlans(ov: OverrideMap): Plan[] {
  return PLANS.map((p) => ({ ...p, ...((ov[`plan:${p.id}`] as Partial<Plan> & { active?: boolean }) ?? {}) })).filter((p) => (p as { active?: boolean }).active !== false);
}

export function mergeRates(ov: OverrideMap): typeof CREDIT_RATES {
  return { ...CREDIT_RATES, ...((ov["credit-rates"] as Partial<typeof CREDIT_RATES>) ?? {}) };
}

export function voiceDefault(ov: OverrideMap, language: string): string | null {
  const v = ov[`voice-default:${language.toLowerCase()}`] as { voiceId?: string } | undefined;
  return v?.voiceId ?? null;
}
