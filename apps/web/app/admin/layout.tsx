import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user || user.role !== "ADMIN") redirect("/dashboard");
  const tabs = [["/admin", "Overview"], ["/admin/projects", "Projects"], ["/admin/users", "Users"], ["/admin/templates", "Templates"], ["/admin/plans", "Plans"], ["/admin/voices", "Voices"], ["/admin/system", "System"]];
  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Admin</h1>
        <nav className="flex gap-1 rounded-xl border border-line p-1 text-sm">
          {tabs.map(([href, label]) => <Link key={href} href={href} className="rounded-lg px-3 py-1.5 text-ink-2 hover:bg-panel-2 hover:text-ink">{label}</Link>)}
        </nav>
      </div>
      <div className="mt-6">{children}</div>
    </div>
  );
}
