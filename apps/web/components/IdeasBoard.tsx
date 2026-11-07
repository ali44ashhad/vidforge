"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Lightbulb, Sparkles, Loader2, Bookmark, X, ArrowRight } from "lucide-react";
import { findTemplate } from "@vidforge/shared";
import { EmptyState, Skeleton } from "@/components/ui/Card";

type Idea = { id?: string; title: string; topic?: string | null; format?: string | null; length?: number | null; lengthSeconds?: number; potential?: string | null; competition?: string | null; why?: string | null; status?: string };
const FILTERS = [["", "All"], ["trending", "Trending"], ["evergreen", "Evergreen"], ["lowcomp", "Low competition"], ["shorts", "Shorts"], ["long", "Long form"]];
const tone = (v?: string | null) => (v === "high" ? "text-success" : v === "low" ? "text-ink-3" : "text-warning");

export default function IdeasBoard() {
  const router = useRouter();
  const [topic, setTopic] = useState(""); const [filter, setFilter] = useState(""); const [gen, setGen] = useState<Idea[]>([]); const [saved, setSaved] = useState<Idea[] | null>(null); const [busy, setBusy] = useState(false); const [err, setErr] = useState<string | null>(null);
  const loadSaved = () => fetch("/api/ideas").then((r) => r.json()).then((d) => setSaved(d.ideas ?? []));
  useEffect(() => { loadSaved(); }, []);
  async function generate() {
    setBusy(true); setErr(null);
    const r = await fetch("/api/ideas/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic, filter }) });
    const d = await r.json(); setBusy(false);
    if (!r.ok) { setErr(d.error ?? "Could not generate ideas"); return; }
    setGen(d.ideas ?? []);
  }
  async function save(i: Idea) { await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...i, length: i.lengthSeconds ?? i.length }) }); setGen(gen.filter((x) => x !== i)); loadSaved(); }
  const create = (i: Idea) => router.push(`/create?type=${encodeURIComponent(i.format ?? "YouTube Video")}&prompt=${encodeURIComponent(`${i.title}. ${i.why ?? ""}`)}`);
  const Card = ({ i, savedRow }: { i: Idea; savedRow?: boolean }) => (
    <div className="flex flex-col rounded-2xl border border-line bg-panel p-4">
      <div className="text-[15px] font-semibold leading-snug">{i.title}</div>
      <div className="mt-2 flex flex-wrap gap-1.5 text-[12px]"><span className="chip">{findTemplate(i.format ?? "")?.name ?? i.format ?? "Video"}</span><span className="chip">{Math.round(((i.lengthSeconds ?? i.length) ?? 480) / 60)} min</span>{i.topic && <span className="chip">{i.topic}</span>}</div>
      <div className="mt-2 flex gap-4 text-[12px]"><span>Potential <b className={tone(i.potential)}>{i.potential ?? "—"}</b></span><span>Competition <b className={tone(i.competition === "low" ? "high" : i.competition === "high" ? "low" : "medium")}>{i.competition ?? "—"}</b></span></div>
      {i.why && <p className="mt-2 flex-1 text-[13px] text-ink-2">{i.why}</p>}
      <div className="mt-3 flex flex-wrap gap-2"><button className="btn-gradient flex items-center gap-1 px-3 py-1.5 text-[13px]" onClick={() => create(i)}>Create video <ArrowRight size={13} /></button>{savedRow ? <button className="btn-ghost px-3 py-1.5 text-[13px]" onClick={async () => { await fetch(`/api/ideas/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "dismissed" }) }); loadSaved(); }}>Not interested</button> : <><button className="btn-ghost flex items-center gap-1 px-3 py-1.5 text-[13px]" onClick={() => save(i)}><Bookmark size={13} /> Save</button><button className="rounded-xl px-2 text-ink-3 hover:text-ink" onClick={() => setGen(gen.filter((x) => x !== i))} title="Not interested"><X size={16} /></button></>}</div>
    </div>
  );
  return (
    <div>
      <div className="mb-6"><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Ideas for your channel</h1><p className="mt-1 text-[15px] text-ink-2">AI-powered video ideas personalized to your audience and content.</p></div>
      <div className="rounded-2xl border border-line bg-panel p-4">
        <div className="flex flex-col gap-2 md:flex-row"><input className="field" placeholder="What kind of ideas are you looking for? e.g. personal finance for students" value={topic} onChange={(e) => setTopic(e.target.value)} onKeyDown={(e) => e.key === "Enter" && generate()} /><button className="btn-gradient flex items-center justify-center gap-2 md:w-48" disabled={busy} onClick={generate}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} Generate ideas</button></div>
        <div className="mt-3 flex flex-wrap gap-2">{FILTERS.map(([v, l]) => <button key={v} onClick={() => setFilter(v)} className={`min-h-[36px] rounded-lg px-3 text-[13px] ${filter === v ? "bg-accent text-white" : "border border-line text-ink-2"}`}>{l}</button>)}</div>
        {err && <p className="mt-2 text-[13px] text-danger">{err}</p>}
      </div>
      {busy && <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="h-44" />)}</div>}
      {gen.length > 0 && !busy && <section className="mt-6"><h2 className="mb-3 text-[15px] font-semibold">Suggested for you</h2><div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{gen.map((i, k) => <Card key={k} i={i} />)}</div></section>}
      <section className="mt-8"><h2 className="mb-3 flex items-center gap-2 text-[15px] font-semibold"><Lightbulb size={16} className="text-warning" /> Saved ideas</h2>
        {saved === null ? <Skeleton className="h-24" /> : saved.length === 0 ? <EmptyState title="No saved ideas yet" sub="Generate ideas above and save the ones you like — they show up in your Content Plan." /> : <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{saved.map((i) => <Card key={i.id} i={i} savedRow />)}</div>}
      </section>
    </div>
  );
}
