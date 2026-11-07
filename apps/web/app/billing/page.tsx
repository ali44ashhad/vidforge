import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import { catalog } from "@/lib/config";
import { visitorCountry } from "@/lib/geo";
import PlanCards from "@/components/PlanCards";
import UsageChart from "@/components/UsageChart";
import { Plus } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function BillingPage() {
  const user = await getUser();
  if (!user) return null;
  const { plans } = await catalog();
  const country = await visitorCountry();
  const [ledger, full, usage] = await Promise.all([
    prisma.creditLedger.findMany({ where: { userId: user.id }, orderBy: { createdAt: "desc" }, take: 40 }),
    prisma.user.findUnique({ where: { id: user.id }, select: { plan: true, planExpiresAt: true, credits: true } }),
    prisma.project.findMany({ where: { userId: user.id, creditsCharged: { gt: 0 } }, select: { creditsCharged: true, visualSource: true, createdAt: true, voiceEnabled: true, musicEnabled: true } }),
  ]);
  const month = (d: Date) => `${d.getFullYear()}-${d.getMonth()}`;
  const now = new Date(), last = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const bucket = (m: string) => usage.filter((u) => month(u.createdAt) === m).reduce((a, u) => { const k = /ai_video/.test(u.visualSource) ? "AI video" : /ai_images|mixed/.test(u.visualSource) ? "AI images" : "Stock & render"; a[k] = (a[k] ?? 0) + u.creditsCharged; return a; }, {} as Record<string, number>);
  const usageData = { thisMonth: bucket(month(now)), lastMonth: bucket(month(last)) };
  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Billing & Credits</h1><p className="mt-1 text-[15px] text-ink-2">Credits are used for AI generation and rendering. Unused reservations are released when a video finishes.</p></div>
        <div className="flex items-center gap-4 rounded-2xl border border-line bg-panel px-5 py-3">
          <div><div className="text-[12px] text-ink-3">Credits available</div><div className="display text-[28px] font-bold tabular-nums leading-none">{full?.credits.toLocaleString()}</div><div className="mt-1 text-[12px] text-ink-3">{plans.find((p) => p.id === full?.plan)?.name ?? "Free"} plan{full?.planExpiresAt ? ` · renews ${full.planExpiresAt.toLocaleDateString()}` : ""}</div></div>
          <a href="#plans" className="btn-gradient flex items-center gap-1.5 px-4 py-2 text-[14px]"><Plus size={16} /> Add credits</a>
        </div>
      </div>
      <div id="plans"><PlanCards current={full?.plan ?? "free"} plans={plans} country={country} /></div>
      <UsageChart data={usageData} />
      <section className="rounded-2xl border border-line bg-panel">
        <div className="border-b border-line px-5 py-3.5 text-[15px] font-semibold">Recent activity</div>
        {ledger.length === 0 ? <p className="p-5 text-[14px] text-ink-3">No activity yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full text-[14px]">
            <thead className="text-left text-[12px] uppercase text-ink-3"><tr><th className="px-5 py-2.5">Date</th><th className="px-5 py-2.5">Action</th><th className="px-5 py-2.5 text-right">Credits</th><th className="px-5 py-2.5 text-right">Balance</th></tr></thead>
            <tbody>{ledger.map((l) => <tr key={l.id} className="border-t border-line"><td className="px-5 py-2.5 text-ink-3">{l.createdAt.toLocaleString()}</td><td className="px-5 py-2.5">{l.reason ?? l.type}</td><td className={`px-5 py-2.5 text-right font-medium tabular-nums ${l.amount > 0 ? "text-success" : "text-warning"}`}>{l.amount > 0 ? "+" : ""}{l.amount}</td><td className="px-5 py-2.5 text-right tabular-nums text-ink-3">{l.balance}</td></tr>)}</tbody>
          </table></div>
        )}
      </section>
    </div>
  );
}
