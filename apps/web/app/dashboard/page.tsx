import Link from "next/link";
import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import { catalog } from "@/lib/config";
import { Plus, Youtube, Coins, ArrowRight, Sparkles } from "lucide-react";
import { StatusPill } from "@/components/ui/Card";
import DashboardStats from "@/components/dashboard/DashboardStats";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const user = await getUser(); if (!user) return null;
  const { plans } = await catalog();
  const weekAgo = new Date(Date.now() - 7 * 86400e3);
  const [full, recent, planned, weekDone, weekAll, savedIdea] = await Promise.all([
    prisma.user.findUnique({ where: { id: user.id }, select: { youtube: true, plan: true, credits: true } }),
    prisma.project.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 6, select: { id: true, title: true, status: true, thumbnailUrl: true, createdAt: true, stats: true, aspectRatio: true } }),
    prisma.idea.count({ where: { userId: user.id, status: "planned", plannedFor: { gte: new Date() } } }),
    prisma.project.count({ where: { userId: user.id, status: "COMPLETED", createdAt: { gte: weekAgo } } }),
    prisma.project.count({ where: { userId: user.id, createdAt: { gte: weekAgo } } }),
    prisma.idea.findFirst({ where: { userId: user.id, status: { in: ["idea", "planned"] } }, orderBy: { createdAt: "desc" } }),
  ]);
  const yt = full?.youtube as { channelTitle: string; thumbnail?: string } | null;
  const hour = new Date().getHours(); const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const first = (user.name ?? "there").split(" ")[0];
  const goal = 2;
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">{greet}, {first}.<br className="md:hidden" /> Let&apos;s grow your channel.</h1><p className="mt-1 text-[15px] text-ink-2">Create → Publish → Grow → Monetize, from one workspace.</p></div>
        <Link href="/create" className="btn-gradient flex items-center gap-2"><Plus size={18} /> Create video</Link>
      </div>
      <div className="grid gap-4 md:grid-cols-[1fr_1fr_1fr]">
        <div className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center gap-3">{yt?.thumbnail ? <img src={yt.thumbnail} alt="" className="h-12 w-12 rounded-full" /> : <span className="flex h-12 w-12 items-center justify-center rounded-full bg-[#ff0000] text-white"><Youtube size={22} /></span>}<div><div className="text-[15px] font-semibold">{yt?.channelTitle ?? "No channel connected"}</div>{yt ? <span className="pill pill-ready">Connected</span> : <a href="/api/youtube/connect" className="text-[13px] text-accent">Connect YouTube →</a>}</div></div>
        </div>
        <div className="rounded-2xl border border-line bg-panel p-5"><div className="text-[13px] text-ink-3">This week</div><div className="mt-1 display text-[28px] font-bold">{weekDone}<span className="text-[14px] font-normal text-ink-3"> / {goal} videos ready</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-panel-2"><div className="h-full bg-gradient-to-r from-[#6650FF] to-[#7B4DFF]" style={{ width: `${Math.min(100, (weekDone / goal) * 100)}%` }} /></div><div className="mt-2 text-[12px] text-ink-3">{weekAll - weekDone > 0 ? `${weekAll - weekDone} generating` : ""} · {planned} planned</div></div>
        <div className="rounded-2xl border border-line bg-panel p-5"><div className="flex items-center gap-2 text-[13px] text-ink-3"><Coins size={14} className="text-warning" /> Credits</div><div className="mt-1 display text-[28px] font-bold tabular-nums">{full?.credits.toLocaleString()}</div><div className="mt-1 text-[12px] text-ink-3">{plans.find((p) => p.id === full?.plan)?.name ?? "Free"} plan · <Link href="/billing" className="text-accent">Upgrade</Link></div></div>
      </div>
      <DashboardStats />
      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <section className="rounded-2xl border border-line bg-panel p-5">
          <div className="flex items-center justify-between"><h2 className="text-[15px] font-semibold">Recent videos</h2><Link href="/projects" className="text-[13px] text-accent">View all →</Link></div>
          {recent.length === 0 ? <div className="mt-4 rounded-xl border border-dashed border-line-2 p-8 text-center"><div className="font-semibold">Create your first video</div><p className="mt-1 text-[13px] text-ink-3">Turn one idea into a complete, upload-ready YouTube video.</p><Link href="/create" className="btn-gradient mt-4 inline-flex text-[14px]">Create video</Link></div> : (
            <ul className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{recent.map((p) => <li key={p.id}><Link href={`/projects/${p.id}`} className="block overflow-hidden rounded-xl border border-line hover:border-line-2"><div className={`relative bg-panel-2 ${p.aspectRatio === "R9_16" ? "aspect-[4/3]" : "aspect-video"}`}>{p.thumbnailUrl && <img src={p.thumbnailUrl} alt="" className="h-full w-full object-cover" />}<span className="absolute left-2 top-2"><StatusPill status={(p.stats as { youtubeUrl?: string } | null)?.youtubeUrl ? "PUBLISHED" : p.status} /></span></div><div className="p-3"><div className="line-clamp-1 text-[14px] font-medium">{p.title}</div><div className="text-[12px] text-ink-3">{new Date(p.createdAt).toLocaleDateString()}</div></div></Link></li>)}</ul>
          )}
        </section>
        <section className="space-y-4">
          <div className="rounded-2xl border border-accent/40 bg-accent/10 p-5">
            <div className="flex items-center gap-2 text-[15px] font-semibold"><Sparkles size={16} className="text-accent" /> Recommended next video</div>
            {savedIdea ? <><p className="mt-2 text-[15px] font-medium">“{savedIdea.title}”</p><p className="mt-1 text-[13px] text-ink-2">{savedIdea.why ?? "Saved from your ideas — good moment to make it."}</p><Link href={`/create?type=${encodeURIComponent(savedIdea.format ?? "YouTube Video")}&prompt=${encodeURIComponent(savedIdea.title)}`} className="btn-gradient mt-3 inline-flex items-center gap-1 text-[13px]">Create this video <ArrowRight size={13} /></Link></>
              : <><p className="mt-2 text-[13px] text-ink-2">Generate personalized ideas from your channel and best-performing topics.</p><Link href="/ideas" className="btn-gradient mt-3 inline-flex items-center gap-1 text-[13px]">Get ideas <ArrowRight size={13} /></Link></>}
          </div>
          <div className="rounded-2xl border border-line bg-panel p-5"><h2 className="text-[15px] font-semibold">Monetization progress</h2><p className="mt-1 text-[13px] text-ink-2">Subscribers, watch hours, consistency and readiness in one place.</p><Link href="/monetization" className="mt-3 inline-flex items-center gap-1 text-[13px] text-accent">Open roadmap <ArrowRight size={13} /></Link></div>
        </section>
      </div>
    </div>
  );
}
