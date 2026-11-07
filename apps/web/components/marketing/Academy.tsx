"use client";

import { useState } from "react";
import { PlayCircle } from "lucide-react";
import { academy } from "@/lib/marketing";
import tutorials from "@/lib/tutorials.json";
import Section from "./Section";
import VideoModal from "./VideoModal";
import AutoRail from "./AutoRail";
import Tilt from "./Tilt";

type T = { id: string; title: string; url: string; thumbnailUrl: string | null; duration: number | null };
const ORDER = ["niche", "first-video", "thumbnails", "publish", "retention", "monetize"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function Academy({ images }: { images: (string | null)[] }) {
  const [open, setOpen] = useState<T | null>(null);
  const vids = new Map((tutorials.items as T[]).map((t) => [t.id, t]));
  const available = tutorials.available && vids.size > 0;
  return (
    <Section id="academy" title={<>Never built a YouTube channel? <span className="text-gradient">Start here.</span></>} sub="Step-by-step lessons to take you from idea to your first published video — made with Y2ube." className="bg-panel/40" depth tone="blue">
      <AutoRail speed={24}>
        {academy.items.map((t, i) => {
          const v = vids.get(ORDER[i]);
          const bg = v?.thumbnailUrl ?? images[i];
          return (
            <Tilt key={t.n} className="w-56 rounded-2xl sm:w-64">
            <button disabled={!v} onClick={() => v && setOpen(v)} className="group block w-full overflow-hidden rounded-2xl border border-line bg-panel text-left disabled:cursor-default">
              <div className="relative aspect-video bg-cover bg-center" style={bg ? { backgroundImage: `url(${bg})` } : { background: `linear-gradient(135deg, hsl(${240 + i * 12} 50% 20%), hsl(${260 + i * 10} 60% 10%))` }}>
                <PlayCircle size={30} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow transition group-hover:scale-110" />
                <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 text-[10px] text-white">{v?.duration ? fmt(v.duration) : "Soon"}</span>
              </div>
              <div className="p-2.5 text-xs"><span className="text-accent">{t.n}</span> <span className="font-medium">{t.title}</span></div>
            </button>
            </Tilt>
          );
        })}
      </AutoRail>
      {!available && <p className="mt-4 text-center text-xs text-ink-3">Lessons are being produced — coming soon.</p>}
      {open && <VideoModal url={open.url} title={open.title} onClose={() => setOpen(null)} />}
    </Section>
  );
}
