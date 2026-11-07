import Image from "next/image";
import { Check, FileText, Image as ImageIcon, Mic, Music, Captions, Tags, ListOrdered, Upload, Play } from "lucide-react";
import { outputs } from "@/lib/marketing";
import Section from "./Section";
import InlineVideo from "./InlineVideo";
import Tilt from "./Tilt";

const L = [FileText, ImageIcon, Mic, Music, Captions]; const R = [ImageIcon, Tags, ListOrdered, Upload];

export default function OutputShowcase({ image, video }: { image: string; video?: string | null }) {
  const Pill = ({ icon: I, t, s }: { icon: typeof FileText; t: string; s: string }) => (
    <Tilt max={6} className="flex items-center gap-3 rounded-xl border border-line bg-panel px-3 py-2.5"><span className="rounded-lg bg-accent/15 p-2 text-accent"><I size={16} /></span><div><div className="text-sm font-semibold">{t}</div><div className="flex items-center gap-1 text-xs text-success"><Check size={11} /> {s}</div></div></Tilt>
  );
  return (
    <Section id="product" depth title={<>One prompt. <span className="text-gradient">Everything your video needs.</span></>} sub="Y2ube generates a complete, upload-ready YouTube video with all the elements you need to grow.">
      <div className="grid items-center gap-4 lg:grid-cols-[230px_1fr_230px]">
        <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{outputs.left.map(([t, s], i) => <Pill key={t} icon={L[i]} t={t} s={s} />)}</div>
        <Tilt max={4} glare={false} className="rounded-2xl">{video ? <InlineVideo src={video} poster={image} label="Y2ube showreel — generated entirely by Y2ube" /> : (
          <div className="group relative overflow-hidden rounded-2xl border border-line-2 shadow-md">
            <Image src={image} width={1280} height={720} alt="Generated video preview: mountain lake documentary" className="aspect-video w-full object-cover" />
            <div className="absolute inset-0 flex items-center justify-center"><span className="flex h-14 w-14 items-center justify-center rounded-full bg-white/90 text-black shadow transition group-hover:scale-110"><Play size={22} /></span></div>
          </div>
        )}</Tilt>
        <div className="stagger grid gap-2 sm:grid-cols-2 lg:grid-cols-1">{outputs.right.map(([t, s], i) => <Pill key={t} icon={R[i]} t={t} s={s} />)}</div>
      </div>
    </Section>
  );
}
