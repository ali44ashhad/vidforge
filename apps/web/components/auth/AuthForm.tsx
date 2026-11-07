"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import Logo from "@/components/Logo";
import AuthShowcase from "./AuthShowcase";
import tutorials from "@/lib/tutorials.json";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const type = params.get("type");
  const next = params.get("next") && params.get("next") !== "/" ? params.get("next")! : type ? `/create?type=${encodeURIComponent(type)}` : "/dashboard";
  const oauthError = params.get("error");
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [name, setName] = useState("");
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(oauthError ? "Google sign-in didn't complete. Try again or use email." : null);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(null);
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email, password, name }) });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) { setError(data.error ?? "Something went wrong."); return; }
    router.push(next); router.refresh();
  }

  return (
    <div className="grid min-h-screen lg:grid-cols-2">
    <AuthShowcase showreel={(tutorials.items as { id: string; url: string }[]).find((t) => t.id === "showreel")?.url ?? null} demo={(tutorials.items as { id: string; url: string }[]).find((t) => t.id === "demo")?.url ?? null} poster="/assets/y2ube/gen/output_demo.jpg" />
    <div className="mx-auto flex w-full max-w-md flex-col justify-center px-5 py-6 lg:py-10">
    <div className="mb-5 lg:hidden"><Logo /></div>
    <AuthShowcase variant="top" showreel={(tutorials.items as { id: string; url: string }[]).find((t) => t.id === "showreel")?.url ?? null} demo={(tutorials.items as { id: string; url: string }[]).find((t) => t.id === "demo")?.url ?? null} poster="/assets/y2ube/gen/output_demo.jpg" />
    <div className="rounded-2xl border border-line bg-panel p-6">
      <h1 className="display text-2xl font-bold">{mode === "login" ? "Welcome back." : "Start building your channel."}</h1>
      <p className="mt-1 text-sm text-ink-3">{mode === "login" ? "Log in to continue to your studio." : "Create, publish and grow your YouTube journey from one workspace. 60 free credits included."}</p>
      <a href={`/api/auth/google?next=${encodeURIComponent(next)}`} className="btn-ghost mt-5 flex w-full items-center justify-center gap-2">
        <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.6l6.2 5.2C40.9 35.6 44 30.3 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>
        Continue with Google
      </a>
      <div className="my-4 flex items-center gap-3 text-xs text-ink-3"><span className="h-px flex-1 bg-line" />or<span className="h-px flex-1 bg-line" /></div>
      <form onSubmit={submit} className="space-y-3">
        {mode === "signup" && <input className="field" placeholder="Your name" value={name} onChange={(e) => setName(e.target.value)} />}
        <input className="field" type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        <input className="field" type="password" placeholder={mode === "signup" ? "Password (8+ characters)" : "Password"} value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
        {error && <p className="text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>{busy ? "Please wait…" : mode === "login" ? "Log in" : "Create account →"}</button>
      </form>
      <p className="mt-4 text-center text-sm text-ink-3">
        {mode === "login" ? <>Don't have an account? <Link href={`/signup?next=${encodeURIComponent(next)}`} className="text-accent">Start free</Link></> : <>Already have an account? <Link href={`/login?next=${encodeURIComponent(next)}`} className="text-accent">Log in</Link></>}
      </p>
    </div>
    </div>
    </div>
  );
}
