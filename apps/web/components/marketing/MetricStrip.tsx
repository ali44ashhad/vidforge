import { metrics } from "@/lib/marketing";
import Counter from "./Counter";
import Reveal from "./Reveal";

/** Shows social-proof metrics only when verified; otherwise real product facts. */
export default function MetricStrip({ facts }: { facts: [string, string][] }) {
  const items = metrics.verified ? (metrics.items as [string, string][]) : facts;
  return (
    <section className="border-y border-line bg-panel/60">
      <Reveal className="mx-auto grid max-w-7xl grid-cols-2 gap-4 px-5 py-6 md:grid-cols-4">
        <div className="stagger contents">{items.map(([n, l]) => <div key={l} className="text-center md:text-left"><div className="display text-2xl font-bold md:text-3xl"><Counter value={n} /></div><div className="text-xs text-ink-3 md:text-sm">{l}</div></div>)}</div>
      </Reveal>
    </section>
  );
}
