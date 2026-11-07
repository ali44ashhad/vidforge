"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import Logo from "@/components/Logo";
import { nav } from "@/lib/marketing";

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [active, setActive] = useState<string>("");
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll(); window.addEventListener("scroll", onScroll, { passive: true });
    const ids = nav.map((n) => n.href.slice(1));
    const io = new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) setActive(`#${e.target.id}`); }, { rootMargin: "-40% 0px -55% 0px" });
    ids.forEach((id) => { const el = document.getElementById(id); if (el) io.observe(el); });
    return () => { window.removeEventListener("scroll", onScroll); io.disconnect(); };
  }, []);
  return (
    <header className={`sticky top-0 z-40 border-b bg-bg/80 backdrop-blur transition-shadow ${scrolled ? "border-line shadow-[0_8px_30px_rgba(0,0,0,.35)]" : "border-transparent"}`}>
      <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-3">
        <Logo />
        <nav className="hidden items-center gap-7 text-sm text-ink-2 lg:flex">{nav.map((n) => <a key={n.label} href={n.href} className={`relative py-1 transition hover:text-ink ${active === n.href ? "text-ink" : ""}`}>{n.label}<span className={`absolute -bottom-0.5 left-0 h-0.5 rounded-full bg-accent transition-all ${active === n.href ? "w-full" : "w-0"}`} /></a>)}</nav>
        <div className="hidden items-center gap-2 lg:flex"><Link href="/login" className="btn-ghost px-4 py-2 text-sm">Log in</Link><Link href="/signup" className="btn-primary px-4 py-2 text-sm">Start free</Link></div>
        <button className="rounded-lg p-2 text-ink-2 lg:hidden" onClick={() => setOpen(!open)} aria-label="Menu">{open ? <X size={22} /> : <Menu size={22} />}</button>
      </div>
      {open && (
        <div className="border-t border-line bg-bg px-5 py-4 lg:hidden" style={{ animation: "reveal-in .2s ease" }}>
          <nav className="grid gap-3 text-base">{nav.map((n) => <a key={n.label} href={n.href} onClick={() => setOpen(false)} className="py-1 text-ink-2">{n.label}</a>)}</nav>
          <div className="mt-4 grid grid-cols-2 gap-2"><Link href="/login" className="btn-ghost text-center text-sm">Log in</Link><Link href="/signup" className="btn-primary text-center text-sm">Start free</Link></div>
        </div>
      )}
    </header>
  );
}
