"use client";

import { useState } from "react";
import { Youtube, User, Users, SlidersHorizontal } from "lucide-react";
import { Tabs } from "@/components/ui/Card";
import YouTubeConnect from "@/components/YouTubeConnect";
import ApiKeysPanel from "@/components/settings/ApiKeysPanel";
import BrandKitEditor from "@/components/BrandKitEditor";
import type { SessionUser } from "@/lib/auth";

export default function SettingsPage({ user, youtube, planName, apiAllowed }: { user: SessionUser; youtube: { channelTitle: string; thumbnail?: string; connectedAt: string } | null; planName: string; apiAllowed: boolean }) {
  const [tab, setTab] = useState("profile");
  const [name, setName] = useState(user.name ?? ""); const [saved, setSaved] = useState<string | null>(null);
  const [pw, setPw] = useState({ current: "", next: "" }); const [pwMsg, setPwMsg] = useState<string | null>(null);
  const [del, setDel] = useState(false); const [confirm, setConfirm] = useState("");
  const initials = (user.name ?? user.email).split(" ").map((x) => x[0]).join("").slice(0, 2).toUpperCase();
  const tabs = [{ id: "profile", label: "Profile" }, { id: "channels", label: "Channels" }, ...(apiAllowed ? [{ id: "api", label: "API Keys" }] : []), { id: "brand", label: "Brand Kit" }, { id: "prefs", label: "Preferences" }, { id: "team", label: "Team" }];
  return (
    <div>
      <div className="mb-6"><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">Settings</h1><p className="mt-1 text-[15px] text-ink-2">Manage your account, YouTube connection and preferences.</p></div>
      <Tabs tabs={tabs} value={tab} onChange={setTab} />
      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        {tab === "profile" && <>
          <section className="rounded-2xl border border-line bg-panel p-5">
            <h2 className="flex items-center gap-2 text-[15px] font-semibold"><User size={16} /> Profile information</h2>
            <div className="mt-4 flex items-center gap-4">{user.image ? <img src={user.image} alt="" className="h-16 w-16 rounded-full" /> : <div className="flex h-16 w-16 items-center justify-center rounded-full bg-accent text-xl font-bold text-white">{initials}</div>}<div className="text-[13px] text-ink-3">Profile photo comes from Google when you sign in with Google.</div></div>
            <div className="mt-4 space-y-3 text-[14px]">
              <label className="block"><span className="mb-1 block text-ink-2">Name</span><input className="field" value={name} onChange={(e) => setName(e.target.value)} /></label>
              <label className="block"><span className="mb-1 block text-ink-2">Email</span><input className="field opacity-70" value={user.email} readOnly /></label>
              <div className="grid grid-cols-2 gap-3"><div><div className="text-ink-2">Role</div><div>{user.role === "ADMIN" ? "Admin" : "Creator"}</div></div><div><div className="text-ink-2">Plan</div><div>{planName}</div></div></div>
              <button className="btn-gradient text-[14px]" onClick={async () => { const r = await fetch("/api/auth/profile", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name }) }); setSaved(r.ok ? "Saved." : "Could not save."); }}>Save changes</button>{saved && <span className="ml-3 text-ink-3">{saved}</span>}
            </div>
          </section>
          <section className="space-y-6">
            <div className="rounded-2xl border border-line bg-panel p-5">
              <h2 className="text-[15px] font-semibold">Account</h2>
              <div className="mt-3 grid gap-2 text-[14px]"><input className="field" type="password" placeholder="Current password (empty if you use Google sign-in)" value={pw.current} onChange={(e) => setPw({ ...pw, current: e.target.value })} /><input className="field" type="password" placeholder="New password (8+ characters)" value={pw.next} onChange={(e) => setPw({ ...pw, next: e.target.value })} /><button className="btn-ghost w-fit text-[14px]" onClick={async () => { const r = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(pw) }); const d = await r.json(); setPwMsg(r.ok ? "Password updated." : d.error); }}>Change password</button>{pwMsg && <span className="text-ink-3">{pwMsg}</span>}</div>
            </div>
            <div className="rounded-2xl border border-danger/40 bg-panel p-5">
              <h2 className="text-[15px] font-semibold text-danger">Danger zone</h2>
              <p className="mt-1 text-[13px] text-ink-3">Deleting your account removes your videos and data. Unused credits are not refunded.</p>
              <button className="mt-3 rounded-xl border border-danger/60 px-4 py-2 text-[14px] text-danger hover:bg-danger/10" onClick={() => setDel(true)}>Delete account</button>
            </div>
          </section>
        </>}
        {tab === "channels" && <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2"><h2 className="flex items-center gap-2 text-[15px] font-semibold"><Youtube size={16} className="text-danger" /> Connected YouTube channel</h2>{youtube ? <div className="mt-4"><YouTubeConnect conn={youtube} /></div> : <div className="mt-4 flex flex-col items-start gap-3 rounded-xl border border-dashed border-line-2 p-5"><div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#ff0000] text-white"><Youtube size={24} /></div><div><div className="font-semibold">Not connected</div><div className="text-[13px] text-ink-3">Connect your YouTube channel to publish directly and access analytics.</div></div><a href="/api/youtube/connect" className="btn-gradient text-[14px]">Connect YouTube</a></div>}</section>}
        {tab === "api" && <section className="lg:col-span-2"><ApiKeysPanel /></section>}
        {tab === "brand" && <section className="lg:col-span-2"><BrandKitEditor compact /></section>}
        {tab === "prefs" && <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2"><h2 className="flex items-center gap-2 text-[15px] font-semibold"><SlidersHorizontal size={16} /> Preferences</h2><p className="mt-2 text-[14px] text-ink-2">Y2ube uses a dark interface designed for long editing sessions. Email notifications for finished videos are on.</p></section>}
        {tab === "team" && <section className="rounded-2xl border border-line bg-panel p-5 lg:col-span-2"><h2 className="flex items-center gap-2 text-[15px] font-semibold"><Users size={16} /> Team</h2><p className="mt-2 text-[14px] text-ink-2">Shared workspaces with teammates are on the roadmap. Contact support@y2ube.io if you need this for your agency now.</p></section>}
      </div>
      {del && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4" onClick={() => setDel(false)}><div className="w-full max-w-md rounded-2xl border border-danger/40 bg-panel p-6" onClick={(e) => e.stopPropagation()}><h3 className="text-lg font-semibold">Delete your account?</h3><p className="mt-2 text-[14px] text-ink-2">This permanently deletes your account and all videos. Type <span className="font-mono">{user.email}</span> to confirm.</p><input className="field mt-3" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder={user.email} /><div className="mt-4 flex justify-end gap-2"><button className="btn-ghost" onClick={() => setDel(false)}>Cancel</button><button className="rounded-xl bg-danger px-4 py-2 font-semibold text-white disabled:opacity-50" disabled={confirm.trim().toLowerCase() !== user.email} onClick={async () => { const r = await fetch("/api/auth/delete", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ confirm }) }); if (r.ok) window.location.href = "/"; }}>Delete permanently</button></div></div></div>}
    </div>
  );
}
