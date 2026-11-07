import { FileText, Image as ImageIcon, Mic, Captions, Search, Youtube, BarChart3 } from "lucide-react";
import { features } from "@/lib/marketing";
import Section from "./Section";
import Tilt from "./Tilt";

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = { FileText, Image: ImageIcon, Mic, Captions, Search, Youtube, BarChart3 };
const TINT = ["#7357FF", "#FFB648", "#4FA3FF", "#A96AFF", "#FF6075", "#31D682", "#FF3D3D", "#4776FF"];

export default function FeatureGrid() {
  return (
    <Section title="Everything you need to succeed." sub="Powerful features built for modern creators.">
      <div className="stagger grid grid-cols-2 gap-3 md:grid-cols-4">
        {features.map((f, i) => { const I = ICONS[f.icon] ?? FileText; return (
          <Tilt key={f.title} className="rounded-2xl border border-line bg-panel p-4 text-center sm:p-5">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl" style={{ background: `${TINT[i]}22`, color: TINT[i] }}><I size={22} /></span>
            <div className="mt-3 font-semibold">{f.title}</div>
            <div className={`text-xs ${f.soon ? "text-ink-3" : "text-ink-2"}`}>{f.sub}</div>
          </Tilt>); })}
      </div>
    </Section>
  );
}
