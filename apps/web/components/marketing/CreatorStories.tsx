import { creatorStories } from "@/lib/marketing";
import Section from "./Section";

/** Rendered only when stories are verified — the concept-art people and numbers are placeholders. */
export default function CreatorStories() {
  if (!creatorStories.verified) return null;
  return (
    <Section id="stories" title="Real creators. Real results." sub="See how creators are using Y2ube to build successful channels.">
      <div className="grid gap-4 md:grid-cols-3">{creatorStories.items.map((c) => <div key={c.name} className="rounded-2xl border border-line bg-panel p-5"><div className="font-semibold">{c.name}</div><div className="text-xs text-ink-3">{c.niche}</div><p className="mt-3 text-sm text-ink-2">“{c.quote}”</p><div className="mt-4 flex gap-6 text-sm"><div><div className="font-bold">{c.subs}</div><div className="text-xs text-ink-3">Subscribers</div></div><div><div className="font-bold">{c.views}</div><div className="text-xs text-ink-3">Channel views</div></div></div></div>)}</div>
    </Section>
  );
}
