import Link from "next/link";
import Logo from "./Logo";

export default function LegalPage({ title, updated, children }: { title: string; updated: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <div className="mb-8 flex items-center justify-between"><Logo /><nav className="flex gap-4 text-sm text-ink-3"><Link href="/privacy">Privacy</Link><Link href="/terms">Terms</Link><Link href="/refunds">Refunds</Link></nav></div>
      <h1 className="text-3xl font-semibold">{title}</h1>
      <p className="mt-1 text-sm text-ink-3">Last updated {updated}</p>
      <div className="prose-y2 mt-8 space-y-5 text-[15px] leading-relaxed text-ink-2 [&_h2]:mt-8 [&_h2]:text-lg [&_h2]:font-medium [&_h2]:text-ink [&_ul]:list-disc [&_ul]:pl-5 [&_li]:mt-1">{children}</div>
    </div>
  );
}
