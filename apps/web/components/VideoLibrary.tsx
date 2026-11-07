"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Film, Plus, Search, Copy, Upload, MoreHorizontal, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { findTemplate, LANGUAGES } from "@vidforge/shared";
import { Tabs, StatusPill, EmptyState, Skeleton } from "@/components/ui/Card";

type P = { id: string; title: string; status: string; progress: number; currentStage: string | null; targetDuration: number; actualDuration: number | null; aspectRatio: string; videoType: string; language: string; thumbnailUrl: string | null; createdAt: string; error: string | null; stats?: Record<string, unknown> | null };
const fmt = (s: number) => `${Math.floor(s / 60)}:${String(Math.round(s % 60)).padStart(2, "0")}`;
const derived = (p: P) => (p.stats?.youtubeUrl ? (p.stats?.youtubePrivacy === "scheduled" ? "SCHEDULED" : "PUBLISHED") : ["COMPLETED", "FAILED", "PAUSED", "QUEUED"].includes(p.status) ? p.status : "GENERATING");

export default function VideoLibrary() {
  const router = useRouter();
  const [rows, setRows] = useState<P[] | null>(null);
  const [tab, setTab] = useState("all"); const [q, setQ] = useState(""); const [type, setType] = useState(""); const [lang, setLang] = useState(""); const [sort, setSort] = useState("newest");
  const load = () => fetch("/api/projects", { cache: "no-store" }).then((r) => r.json()).then((d) => setRows(d.projects ?? []));
  useEffect(() => { load(); const t = setInterval(load, 8000); return () => clearInterval(t); }, []);
  const list = useMemo(() => {
    let l = rows ?? [];
    if (tab !== "all") l = l.filter((p) => derived(p) === tab.toUpperCase());
    if (q) l = l.filter((p) => p.title.toLowerCase().includes(q.toLowerCase()));
    if (type) l = l.filter((p) => p.videoType === type); if (lang) l = l.filter((p) => p.language === lang);
    l = [...l].sort((a, b) => sort === "oldest" ? a.createdAt.localeCompare(b.createdAt) : sort === "title" ? a.title.localeCompare(b.title) : b.createdAt.localeCompare(a.createdAt));
    return l;
  }, [rows, tab, q, type, lang, sort]);
  const count = (k: string) => (rows ?? []).filter((p) => k === "all" || derived(p) === k.toUpperCase()).length;
  const types = [...new Set((rows ?? []).map((p) => p.videoType))];
  async function del(p: P) { if (!confirm(`Delete "${p.title}"?`)) return; await fetch(`/api/projects/${p.id}`, { method: "DELETE" }); load(); }

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">My Videos</h1><p className="mt-1 text-[15px] text-ink-2">All your created videos in one place.</p></div>
        <Link href="/create" className="btn-gradient flex items-center gap-2"><Plus size={18} /> New video</Link>
      </div>
      <Tabs value={tab} onChange={setTab} tabs={[{ id: "all", label: "All", count: count("all") }, { id: "generating", label: "Generating", count: count("generating") }, { id: "completed", label: "Ready", count: count("completed") }, { id: "scheduled", label: "Scheduled", count: count("scheduled") }, { id: "published", label: "Published", count: count("published") }, { id: "failed", label: "Failed", count: count("failed") }]} />
      <div className="mt-4 flex flex-wrap gap-2">
        <div className="relative min-w-[220px] flex-1"><Search size={16} className="absolute left-3 top-3.5 text-ink-3" /><input className="field pl-9" placeholder="Search videos…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="field max-w-[180px]" value={type} onChange={(e) => setType(e.target.value)}><option value="">All types</option>{types.map((t) => <option key={t} value={t}>{findTemplate(t)?.name ?? t}</option>)}</select>
        <select className="field max-w-[160px]" value={lang} onChange={(e) => setLang(e.target.value)}><option value="">All languages</option>{LANGUAGES.map((l) => <option key={l}>{l}</option>)}</select>
        <select className="field max-w-[140px]" value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Newest</option><option value="oldest">Oldest</option><option value="title">Title</option></select>
      </div>
      {rows === null ? <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }).map((_, i) => <Skeleton key={i} className="aspect-[4/3]" />)}</div>
        : list.length === 0 ? <div className="mt-6"><EmptyState image="/illustrations/no-videos.svg" title={rows.length ? "No videos match" : "Create your first video"} sub={rows.length ? "Try another filter or search term." : "Turn one idea into a complete, upload-ready YouTube video."} action={rows.length ? undefined : <Link href="/create" className="btn-gradient inline-flex">Create video</Link>} /></div>
        : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {list.map((p) => { const st = derived(p); const vertical = p.aspectRatio === "R9_16"; return (
              <div key={p.id} className="group relative overflow-hidden rounded-2xl border border-line bg-panel transition hover:border-line-2">
                <Link href={`/projects/${p.id}`} className="block">
                  <div className={`relative w-full overflow-hidden bg-panel-2 ${vertical ? "aspect-[4/3]" : "aspect-video"}`}>
                    {p.thumbnailUrl ? <img src={p.thumbnailUrl} alt="" className={`h-full w-full ${vertical ? "object-contain" : "object-cover"} transition group-hover:scale-[1.03]`} /> : <div className="flex h-full items-center justify-center bg-[radial-gradient(60%_60%_at_50%_40%,rgba(108,76,255,.35),transparent)] text-ink-3"><Film size={30} /></div>}
                    <span className="absolute left-2 top-2"><StatusPill status={st} /></span>
                    {p.actualDuration ? <span className="absolute bottom-2 right-2 rounded bg-black/70 px-1.5 py-0.5 text-[11px] text-white">{fmt(p.actualDuration)}</span> : null}
                    {st === "GENERATING" && <div className="absolute inset-x-0 bottom-0 h-1 bg-panel-3"><div className="h-full bg-accent" style={{ width: `${p.progress}%` }} /></div>}
                  </div>
                  <div className="p-3.5"><div className="line-clamp-2 text-[15px] font-semibold leading-snug">{p.title}</div><div className="mt-1 text-[12px] text-ink-3">{findTemplate(p.videoType)?.name ?? p.videoType} · {p.language} · {new Date(p.createdAt).toLocaleDateString()}</div>{st === "FAILED" && p.error && <div className="mt-1 line-clamp-1 text-[12px] text-danger">{p.error}</div>}</div>
                </Link>
                <div className="absolute right-2 top-2 hidden gap-1 group-hover:flex">
                  <button title="Duplicate" className="rounded-md bg-black/70 p-1.5 text-white hover:bg-black/90" onClick={() => router.push(`/create?from=${p.id}`)}><Copy size={13} /></button>
                  {st === "COMPLETED" && <button title="Publish" className="rounded-md bg-black/70 p-1.5 text-white hover:bg-black/90" onClick={() => router.push(`/projects/${p.id}#publish`)}><Upload size={13} /></button>}
                  <button title="Delete" className="rounded-md bg-black/70 p-1.5 text-white hover:bg-danger" onClick={() => del(p)}><Trash2 size={13} /></button>
                </div>
              </div>); })}
          </div>
        )}
    </div>
  );
}
