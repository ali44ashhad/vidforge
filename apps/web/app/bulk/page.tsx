import Link from "next/link";
import { prisma } from "@vidforge/db";
import { getUser } from "@/lib/auth";
import BulkCreate from "@/components/BulkCreate";

export const dynamic = "force-dynamic";

export default async function BulkPage() {
  const user = await getUser();
  if (!user) return null;
  const batches = await prisma.batch.findMany({ where: user.role === "ADMIN" ? {} : { userId: user.id }, orderBy: { createdAt: "desc" }, take: 20, include: { _count: { select: { projects: true } } } });
  return (
    <div className="space-y-8">
      <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Bulk Video Creation</h1><p className="mt-1 text-[15px] text-ink-2">Create many videos at once from a list of topics. Each topic becomes its own project.</p></div>
      <BulkCreate />
      {batches.length > 0 && (
        <section>
          <h2 className="mb-3 text-sm font-medium text-ink-2">Recent batches</h2>
          <div className="grid gap-2">
            {batches.map((b) => <Link key={b.id} href={`/bulk/${b.id}`} className="panel flex items-center justify-between p-4 hover:border-line-2"><div><div className="font-medium">{b.name}</div><div className="text-xs text-ink-3">{b._count.projects} videos · {new Date(b.createdAt).toLocaleString()}</div></div><span className="text-sm text-ink-2">Open</span></Link>)}
          </div>
        </section>
      )}
    </div>
  );
}
