"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Sparkles, Film, Lightbulb, CalendarDays, BarChart3, Coins, LayoutGrid, GraduationCap, Palette, CreditCard, Settings, Shield, Menu, X, ChevronLeft, ChevronRight, Bell, HelpCircle, LogOut } from "lucide-react";
import Logo from "@/components/Logo";
import type { SessionUser } from "@/lib/auth";

export const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/create", label: "Create", icon: Sparkles },
  { href: "/projects", label: "My Videos", icon: Film },
  { href: "/ideas", label: "Ideas", icon: Lightbulb },
  { href: "/content-plan", label: "Content Plan", icon: CalendarDays },
  { href: "/analytics", label: "Analytics", icon: BarChart3 },
  { href: "/monetization", label: "Monetization", icon: Coins },
  { href: "/templates", label: "Templates", icon: LayoutGrid },
  { href: "/academy", label: "Academy", icon: GraduationCap },
  { href: "/brand-kit", label: "Brand Kit", icon: Palette },
];
const NAV2 = [{ href: "/billing", label: "Billing", icon: CreditCard }, { href: "/settings", label: "Settings", icon: Settings }];
const MOBILE = [NAV[1], NAV[2], NAV[5], NAV[6], NAV2[1]];

/** One shell for every authenticated page: sidebar (collapsible), topbar, content, mobile drawer + tab bar. */
export default function DashboardShell({ user, children }: { user: SessionUser; children: React.ReactNode }) {
  const path = usePathname();
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const active = (h: string) => path === h || path.startsWith(h + "/");
  const Item = ({ href, label, icon: I }: { href: string; label: string; icon: typeof Film }) => (
    <Link href={href} onClick={() => setOpen(false)} title={collapsed ? label : undefined} className={`flex min-h-[42px] items-center gap-3 rounded-xl px-3 text-[14px] transition ${active(href) ? "nav-active font-medium" : "text-ink-2 hover:bg-white/5 hover:text-ink"} ${collapsed ? "justify-center" : ""}`}>
      <I size={18} className={active(href) ? "text-accent" : ""} />{!collapsed && <span>{label}</span>}
    </Link>
  );
  const Side = (
    <>
      <div className={`flex items-center ${collapsed ? "justify-center" : "justify-between"} px-4 py-5`}><Logo compact={collapsed} href="/dashboard" /><button className="hidden rounded-lg p-1 text-ink-3 hover:text-ink lg:block" onClick={() => setCollapsed(!collapsed)} aria-label="Toggle sidebar">{collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}</button></div>
      <nav className="flex-1 space-y-0.5 overflow-y-auto px-3">{NAV.map((n) => <Item key={n.href} {...n} />)}<div className="my-3 h-px bg-line" />{NAV2.map((n) => <Item key={n.href} {...n} />)}{user.role === "ADMIN" && <Item href="/admin" label="Admin" icon={Shield} />}</nav>
      <div className="border-t border-line p-3">
        {!collapsed && <div className="mb-2 flex items-center justify-between text-sm"><span className="flex items-center gap-1.5 text-ink-2"><Coins size={14} className="text-warning" /> {user.credits.toLocaleString()} credits</span></div>}
        <Link href="/billing" className={`btn-gradient flex w-full items-center justify-center py-2 text-sm ${collapsed ? "px-0" : ""}`}>{collapsed ? "+" : "Upgrade"}</Link>
      </div>
    </>
  );
  return (
    <div className="min-h-screen bg-bg">
      <aside className={`fixed inset-y-0 left-0 z-40 hidden flex-col border-r border-line bg-[rgb(var(--sidebar))] transition-all lg:flex ${collapsed ? "w-[72px]" : "w-[232px]"}`}>{Side}</aside>
      {open && <div className="fixed inset-0 z-50 lg:hidden"><div className="absolute inset-0 bg-black/60" onClick={() => setOpen(false)} /><aside className="absolute inset-y-0 left-0 flex w-[280px] flex-col bg-[rgb(var(--sidebar))] shadow-md"><button className="absolute right-3 top-4 text-ink-3" onClick={() => setOpen(false)} aria-label="Close"><X size={20} /></button>{Side}</aside></div>}
      <div className={`transition-all ${collapsed ? "lg:pl-[72px]" : "lg:pl-[232px]"}`}>
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-line bg-bg/85 px-4 backdrop-blur md:px-6">
          <div className="flex items-center gap-3"><button className="rounded-lg p-2 text-ink-2 lg:hidden" onClick={() => setOpen(true)} aria-label="Menu"><Menu size={20} /></button><span className="text-sm text-ink-3">{[...NAV, ...NAV2].find((n) => active(n.href))?.label ?? ""}</span></div>
          <div className="flex items-center gap-1">
            <a href="mailto:support@y2ube.io" className="rounded-lg p-2 text-ink-3 hover:text-ink" title="Help"><HelpCircle size={18} /></a>
            <button className="rounded-lg p-2 text-ink-3 hover:text-ink" title="Notifications"><Bell size={18} /></button>
            <UserMenu user={user} />
          </div>
        </header>
        <main className="mx-auto w-full max-w-[1440px] px-4 py-6 pb-[calc(84px+env(safe-area-inset-bottom))] md:px-8 md:py-8 lg:pb-10">{children}</main>
        <nav className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-line bg-[rgb(var(--sidebar))] pb-[env(safe-area-inset-bottom)] lg:hidden">
          {MOBILE.map((n) => <Link key={n.href} href={n.href} className={`flex min-h-[56px] flex-col items-center justify-center gap-1 text-[11px] ${active(n.href) ? "text-accent" : "text-ink-3"}`}><n.icon size={20} />{n.label.split(" ")[0]}</Link>)}
        </nav>
      </div>
    </div>
  );
}

function UserMenu({ user }: { user: SessionUser }) {
  const [open, setOpen] = useState(false);
  const initials = (user.name ?? user.email).split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  return (
    <div className="relative">
      <button onClick={() => setOpen(!open)} className="ml-1 flex h-9 w-9 items-center justify-center rounded-full bg-accent text-xs font-bold text-white" aria-label="Account">{user.image ? <img src={user.image} alt="" className="h-9 w-9 rounded-full" /> : initials}</button>
      {open && <div className="absolute right-0 mt-2 w-56 rounded-xl border border-line bg-panel p-2 text-sm shadow-md" onMouseLeave={() => setOpen(false)}>
        <div className="px-2 py-1.5"><div className="font-medium">{user.name ?? "Creator"}</div><div className="truncate text-xs text-ink-3">{user.email}</div></div>
        <Link href="/settings" className="block rounded-lg px-2 py-1.5 hover:bg-white/5">Settings</Link><Link href="/billing" className="block rounded-lg px-2 py-1.5 hover:bg-white/5">Billing</Link>
        <button className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left hover:bg-white/5" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); window.location.href = "/login"; }}><LogOut size={14} /> Sign out</button>
      </div>}
    </div>
  );
}
