"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Coins, LogOut } from "lucide-react";
import type { SessionUser } from "@/lib/auth";

export default function UserMenu({ user }: { user: SessionUser | null }) {
  const router = useRouter();
  if (!user) return <Link href="/login" className="btn-primary px-4 py-2 text-sm">Sign in</Link>;
  return (
    <div className="flex items-center gap-3">
      <Link href="/billing" className="flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm hover:border-accent" title="Credits">
        <Coins size={14} className="text-warning" /> {user.credits.toLocaleString()}
      </Link>
      <button className="flex items-center gap-1 text-sm text-ink-2 hover:text-ink" onClick={async () => { await fetch("/api/auth/logout", { method: "POST" }); router.push("/login"); router.refresh(); }} title={user.email}>
        <LogOut size={15} /> <span className="hidden sm:inline">{user.name?.split(" ")[0] ?? "Sign out"}</span>
      </button>
    </div>
  );
}
