/** Monetization requirements as replaceable data (values from analytics when connected). */
export type MonetizationRequirement = { id: string; label: string; current: number; target: number; unit: string; completed: boolean; note?: string };

export function buildRequirements(input: { subscribers: number; watchHours365: number; videosPublished90d: number; connected: boolean }): MonetizationRequirement[] {
  const r = (id: string, label: string, current: number, target: number, unit: string, note?: string): MonetizationRequirement => ({ id, label, current, target, unit, completed: current >= target, note });
  return [
    r("subs", "Subscribers", input.subscribers, 1000, "subscribers", "YouTube Partner Program threshold — check YouTube's current requirements"),
    r("hours", "Public watch hours (12 months)", input.watchHours365, 4000, "hours"),
    r("consistency", "Videos published in 90 days", input.videosPublished90d, 12, "videos", "Consistency target set by Y2ube (about one per week)"),
    r("setup", "Channel connected & profile complete", input.connected ? 1 : 0, 1, "", "Connect YouTube in Settings"),
  ];
}
