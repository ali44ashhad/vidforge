import Link from "next/link";
import Logo from "@/components/Logo";
import { footer } from "@/lib/marketing";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto grid max-w-7xl gap-8 px-5 py-12 text-sm md:grid-cols-[1.6fr_1fr_1fr_1fr_1fr]">
        <div><Logo /><p className="mt-2 font-medium">{footer.tagline}</p><p className="mt-2 max-w-xs text-ink-3">{footer.blurb}</p></div>
        {footer.columns.map((c) => (
          <div key={c.title}><div className="mb-3 font-semibold">{c.title}</div><ul className="space-y-2 text-ink-3">{c.links.map(([l, h]) => <li key={l}>{h.startsWith("/") ? <Link href={h} className="hover:text-ink">{l}</Link> : <a href={h} className="hover:text-ink">{l}</a>}</li>)}</ul></div>
        ))}
      </div>
      <div className="border-t border-line"><div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-5 py-4 text-xs text-ink-3"><span>© {new Date().getFullYear()} Y2ube · FNA Marketing Solutions. All rights reserved.</span><span className="flex gap-4"><Link href="/terms">Terms</Link><Link href="/privacy">Privacy</Link><Link href="/refunds">Refunds</Link></span></div></div>
    </footer>
  );
}
