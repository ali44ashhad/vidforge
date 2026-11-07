"use client";

import { useEffect, useState } from "react";
import { PLANS } from "@vidforge/shared";

type U = { id: string; email: string; name: string | null; role: string; plan: string; planExpiresAt: string | null; credits: number; suspended: boolean; createdAt: string; projects: number; _count: { payments: number } };

export default function AdminUsers() {
  const [rows, setRows] = useState<U[]>([]); const [q, setQ] = useState("");
  const load = () => fetch(`/api/admin/users?q=${encodeURIComponent(q)}`).then((r) => r.json()).then((d) => setRows(d.users ?? []));
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [q]); // eslint-disable-line react-hooks/exhaustive-deps
  async function act(id: string, body: Record<string, unknown>) {
    await fetch(`/api/admin/users/${id}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }); load();
  }
  return (
    <div>
      <input className="field max-w-sm" placeholder="Search email or name" value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="mt-4 overflow-x-auto rounded-xl border border-line">
        <table className="w-full text-sm">
          <thead className="bg-panel-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-3 py-2">User</th><th className="px-3 py-2">Plan</th><th className="px-3 py-2 text-right">Credits</th><th className="px-3 py-2 text-right">Videos</th><th className="px-3 py-2">Joined</th><th className="px-3 py-2">Actions</th></tr></thead>
          <tbody>{rows.map((u) => (
            <tr key={u.id} className={`border-t border-line ${u.suspended ? "opacity-60" : ""}`}>
              <td className="px-3 py-2"><div className="font-medium">{u.name ?? "—"} {u.role === "ADMIN" && <span className="chip">admin</span>} {u.suspended && <span className="chip text-danger">suspended</span>}</div><div className="text-xs text-ink-3">{u.email}</div></td>
              <td className="px-3 py-2 text-xs">{PLANS.find((p) => p.id === u.plan)?.name ?? u.plan}{u.planExpiresAt && <div className="text-ink-3">until {new Date(u.planExpiresAt).toLocaleDateString()}</div>}<div className="text-ink-3">{u._count.payments} payments</div></td>
              <td className="px-3 py-2 text-right">{u.credits.toLocaleString()}</td>
              <td className="px-3 py-2 text-right">{u.projects}</td>
              <td className="px-3 py-2 text-xs text-ink-3">{new Date(u.createdAt).toLocaleDateString()}</td>
              <td className="px-3 py-2">
                <div className="flex flex-wrap gap-1 text-xs">
                  <button className="chip hover:border-accent" onClick={() => { const a = prompt("Credits to grant (negative to deduct):"); const r = a && prompt("Reason:"); if (a && r) act(u.id, { action: "grant", amount: Number(a), reason: r }); }}>Grant credits</button>
                  <select className="chip cursor-pointer" value={u.plan} onChange={(e) => act(u.id, { action: "plan", plan: e.target.value })}>{PLANS.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}</select>
                  <button className="chip hover:border-warning" onClick={() => act(u.id, { action: u.suspended ? "unsuspend" : "suspend" })}>{u.suspended ? "Unsuspend" : "Suspend"}</button>
                  <button className="chip hover:border-accent" onClick={() => act(u.id, { action: "role", role: u.role === "ADMIN" ? "USER" : "ADMIN" })}>{u.role === "ADMIN" ? "Make member" : "Make admin"}</button>
                </div>
              </td>
            </tr>
          ))}</tbody>
        </table>
      </div>
    </div>
  );
}
