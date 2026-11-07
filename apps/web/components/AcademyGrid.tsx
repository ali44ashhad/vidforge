"use client";

import { useEffect, useState } from "react";
import { PlayCircle, Check, Sparkles, Loader2 } from "lucide-react";
import VideoModal from "@/components/marketing/VideoModal";
import { EmptyState, Skeleton } from "@/components/ui/Card";

type L = { id: string; category: string; title: string; description: string | null; order: number; video: { status: string; progress: number; finalVideoUrl: string | null; thumbnailUrl: string | null; actualDuration: number | null } | null };
const CATS = ["All", "Getting Started", "Video Creation", "Thumbnails", "YouTube SEO", "Growth", "Analytics", "Monetization"];
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;

export default function AcademyGrid({ images, admin }: { images: (string | null)[]; admin: boolean }) {
  const [lessons, setLessons] = useState<L[] | null>(null); const [cat, setCat] = useState("All"); const [open, setOpen] = useState<L | null>(null); const [done, setDone] = useState<string[]>([]); const [gen, setGen] = useState(false); const [msg, setMsg] = useState<string | null>(null); const [phase, setPhase] = useState<string | null>(null);
  const load = () => fetch("/api/academy/lessons").then((r) => r.json()).then((d) => setLessons(d.lessons ?? []));
  useEffect(() => { load(); try { setDone(JSON.parse(localStorage.getItem("y2-academy") || "[]")); } catch { /* ignore */ } const t = setInterval(load, 20000); return () => clearInterval(t); }, []);
  const mark = (id: string) => { const d = [...new Set([...done, id])]; setDone(d); localStorage.setItem("y2-academy", JSON.stringify(d)); };
  async function generate() {
    const topic = prompt("Course topic:", "YouTube success with AI video: from first video to monetization"); if (topic === null) return;
    const n = Number(prompt("How many lessons? (4–16)", "8") || 8);
    setGen(true); setMsg(null); setPhase("Starting course generation…");
    try {
      const r = await fetch("/api/academy/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, lessons: n }) });
      const d = await r.json().catch(() => ({}));
      setMsg(r.ok ? `Course generation started: the AI is writing ${d.lessons} lessons (about a minute), then each lesson video is generated. This page refreshes itself.` : d.error ?? "Could not start the course.");
    } catch (e) { setMsg(`Request failed: ${(e as Error).message}`); }
    setPhase(null); setGen(false); setTimeout(load, 15000);
  }
  const list = (lessons ?? []).filter((l) => cat === "All" || l.category === cat);
  const ready = (lessons ?? []).filter((l) => l.video?.status === "COMPLETED").length;
  const progress = lessons && lessons.length ? Math.round((done.length / lessons.length) * 100) : 0;
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Creator Academy</h1><p className="mt-1 text-[15px] text-ink-2">Video lessons — made with Y2ube — on building, growing and monetizing a channel.</p></div>
        <div className="flex items-center gap-3">{admin && <button className="btn-gradient flex items-center gap-2 text-[14px]" disabled={gen} onClick={generate}>{gen ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate course with AI</button>}<div className="rounded-xl border border-line px-4 py-2 text-[13px]"><span className="text-ink-3">Your progress</span> <b>{progress}%</b><div className="mt-1 h-1.5 w-40 overflow-hidden rounded-full bg-panel-2"><div className="h-full bg-success" style={{ width: `${progress}%` }} /></div></div></div>
      </div>
      {phase && <p className="mb-4 flex items-center gap-2 rounded-xl border border-accent/40 bg-accent/10 px-4 py-2 text-[14px]"><Loader2 size={14} className="animate-spin" /> {phase}</p>}
      {msg && <p className="mb-4 rounded-xl border border-line bg-panel-2 px-4 py-2 text-[14px] text-ink-2">{msg}</p>}
      <div className="flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none]">{CATS.map((c) => <button key={c} onClick={() => setCat(c)} className={`min-h-[40px] whitespace-nowrap rounded-lg px-3.5 text-[13px] ${cat === c ? "bg-accent text-white" : "border border-line text-ink-2"}`}>{c}</button>)}</div>
      {lessons === null ? <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-52" />)}</div>
        : list.length === 0 ? <div className="mt-4"><EmptyState title={lessons.length ? "No lessons in this category yet" : "The Academy is being produced"} sub={lessons.length ? "Pick another category." : admin ? "Click “Generate course with AI” to create the full learning path — every lesson is rendered as a video." : "Lessons will appear here as they are published."} /></div>
        : <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {list.map((l, i) => { const v = l.video; const readyV = v?.status === "COMPLETED" && v.finalVideoUrl; const bg = v?.thumbnailUrl ?? images[i % Math.max(1, images.length)]; return (
            <button key={l.id} disabled={!readyV} onClick={() => { if (readyV) { setOpen(l); mark(l.id); } }} className="group overflow-hidden rounded-2xl border border-line bg-panel text-left transition hover:border-line-2 disabled:cursor-default">
              <div className="relative aspect-video bg-cover bg-center" style={bg ? { backgroundImage: `url(${bg})` } : { background: "linear-gradient(135deg,#1c1f3a,#0d121c)" }}>
                <PlayCircle size={34} className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-white/90 drop-shadow" />
                <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 text-[11px] text-white">{readyV ? fmt(v!.actualDuration ?? 0) : v ? `${v.progress}%` : "Soon"}</span>
                {done.includes(l.id) && <span className="absolute left-2 top-2 pill pill-ready"><Check size={11} /> watched</span>}
              </div>
              <div className="p-4"><div className="text-[12px] text-accent">{l.category} · Lesson {l.order + 1}</div><div className="mt-0.5 text-[15px] font-semibold">{l.title}</div>{l.description && <p className="mt-1 line-clamp-2 text-[12px] text-ink-3">{l.description}</p>}</div>
            </button>); })}
        </div>}
      <p className="mt-4 text-[12px] text-ink-3">{ready} of {lessons?.length ?? 0} lessons ready.</p>
      {open?.video?.finalVideoUrl && <VideoModal url={open.video.finalVideoUrl} title={open.title} onClose={() => setOpen(null)} />}
    </div>
  );
}
