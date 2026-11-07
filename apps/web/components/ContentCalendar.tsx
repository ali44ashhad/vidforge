"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ChevronLeft, ChevronRight, Plus, Sparkles, Loader2 } from "lucide-react";
import { findTemplate } from "@vidforge/shared";

type Item = { id: string; title: string; format?: string | null; status: string; plannedFor?: string | null; projectId?: string | null; kind: "idea" | "project" };
const STATUS: Record<string, string> = { idea: "pill-draft", planned: "pill-scheduled", draft: "pill-draft", generating: "pill-generating", ready: "pill-ready", scheduled: "pill-scheduled", published: "pill-published", failed: "pill-failed" };
const iso = (d: Date) => d.toISOString().slice(0, 10);

export default function ContentCalendar() {
  const [month, setMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [items, setItems] = useState<Item[] | null>(null); const [adding, setAdding] = useState<string | null>(null); const [title, setTitle] = useState(""); const [busy, setBusy] = useState(false);
  const load = async () => {
    const [ideas, projects] = await Promise.all([fetch("/api/ideas").then((r) => r.json()), fetch("/api/projects").then((r) => r.json())]);
    const a: Item[] = (ideas.ideas ?? []).filter((i: Item) => i.plannedFor).map((i: Item) => ({ ...i, kind: "idea" as const }));
    const b: Item[] = (projects.projects ?? []).map((p: { id: string; title: string; videoType: string; status: string; createdAt: string; stats?: Record<string, unknown> }) => ({ id: p.id, title: p.title, format: p.videoType, status: p.stats?.youtubeUrl ? "published" : p.status === "COMPLETED" ? "ready" : p.status === "FAILED" ? "failed" : "generating", plannedFor: p.createdAt, projectId: p.id, kind: "project" as const }));
    setItems([...a, ...b]);
  };
  useEffect(() => { load(); }, []);
  const days = useMemo(() => { const first = new Date(month); const start = new Date(first); start.setDate(first.getDate() - ((first.getDay() + 6) % 7)); return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; }); }, [month]);
  const byDay = (d: Date) => (items ?? []).filter((i) => i.plannedFor && iso(new Date(i.plannedFor)) === iso(d));
  async function add(date: string) { if (!title.trim()) return; setBusy(true); await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title, plannedFor: date }) }); setTitle(""); setAdding(null); setBusy(false); load(); }
  async function planMonth() {
    setBusy(true);
    let ideas = ((await (await fetch("/api/ideas?status=idea")).json()).ideas ?? []) as Item[];
    const slots: Date[] = []; const d = new Date(month); const end = new Date(month.getFullYear(), month.getMonth() + 1, 0);
    for (let x = new Date(Math.max(d.getTime(), Date.now())); x <= end; x.setDate(x.getDate() + 1)) if ([2, 5].includes(x.getDay())) slots.push(new Date(x)); // Tue & Fri
    if (ideas.length < slots.length) {
      // not enough saved ideas → ask the AI for more, personalised to this channel, and save them
      const r = await fetch("/api/ideas/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ topic: "", filter: "" }) });
      const g = (await r.json().catch(() => ({}))).ideas ?? [];
      for (const gi of g.slice(0, slots.length - ideas.length)) { const c = await fetch("/api/ideas", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...gi, length: gi.lengthSeconds }) }); const saved = (await c.json()).idea; if (saved) ideas.push(saved); }
    }
    await Promise.all(ideas.slice(0, slots.length).map((i, k) => fetch(`/api/ideas/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "planned", plannedFor: iso(slots[k]) }) })));
    setBusy(false); load();
  }
  const today = iso(new Date());
  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Content Plan</h1><p className="mt-1 text-[15px] text-ink-2">Your videos and saved ideas on a calendar. Publish twice a week to build consistency.</p></div>
        <div className="flex flex-wrap gap-2"><button className="btn-ghost flex items-center gap-2 text-[14px]" onClick={planMonth} disabled={busy}>{busy ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />} AI plan my month</button><button className="btn-gradient flex items-center gap-2 text-[14px]" onClick={() => setAdding(today)}><Plus size={16} /> Add content</button></div>
      </div>
      <div className="rounded-2xl border border-line bg-panel">
        <div className="flex items-center justify-between border-b border-line px-4 py-3"><button className="btn-ghost px-2 py-1" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><ChevronLeft size={16} /></button><div className="text-[15px] font-semibold">{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</div><button className="btn-ghost px-2 py-1" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><ChevronRight size={16} /></button></div>
        <div className="hidden grid-cols-7 border-b border-line text-center text-[12px] uppercase text-ink-3 md:grid">{["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => <div key={d} className="py-2">{d}</div>)}</div>
        <div className="grid grid-cols-1 md:grid-cols-7">
          {days.map((d) => { const inMonth = d.getMonth() === month.getMonth(); const list = byDay(d); if (!inMonth && list.length === 0 && window.innerWidth < 768) return null; return (
            <div key={iso(d)} className={`min-h-[96px] border-b border-r border-line p-2 ${inMonth ? "" : "opacity-40"}`}>
              <div className="flex items-center justify-between"><span className={`text-[12px] ${iso(d) === today ? "rounded-full bg-accent px-1.5 text-white" : "text-ink-3"}`}>{d.getDate()}<span className="md:hidden"> {d.toLocaleDateString(undefined, { weekday: "short" })}</span></span><button className="text-ink-3 hover:text-ink" onClick={() => setAdding(iso(d))} aria-label="Add"><Plus size={14} /></button></div>
              <div className="mt-1 space-y-1">{list.map((i) => i.projectId ? <Link key={i.id} href={`/projects/${i.projectId}`} className="block rounded-md border border-line bg-panel-2 px-1.5 py-1 text-[11px] hover:border-accent"><span className={`pill ${STATUS[i.status] ?? "pill-draft"} mr-1`}>{i.status}</span>{i.title}</Link> : <div key={i.id} className="rounded-md border border-line bg-panel-2 px-1.5 py-1 text-[11px]"><span className={`pill ${STATUS[i.status] ?? "pill-draft"} mr-1`}>{i.status}</span>{i.title}<div className="mt-1 flex gap-2 text-[10px]"><Link href={`/create?type=${encodeURIComponent(i.format ?? "YouTube Video")}&prompt=${encodeURIComponent(i.title)}`} className="text-accent">Create</Link><button className="text-ink-3" onClick={async () => { await fetch(`/api/ideas/${i.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ plannedFor: null, status: "idea" }) }); load(); }}>Unschedule</button></div></div>)}</div>
              {adding === iso(d) && <div className="mt-1"><input autoFocus className="field px-2 py-1 text-[12px]" placeholder="Title" value={title} onChange={(e) => setTitle(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") add(iso(d)); if (e.key === "Escape") setAdding(null); }} /></div>}
            </div>); })}
        </div>
      </div>
      <p className="mt-3 text-[12px] text-ink-3">{findTemplate("YouTube Video") ? "Ideas on the calendar link to Create with the title prefilled; created videos appear on the day they were made." : ""}</p>
    </div>
  );
}
