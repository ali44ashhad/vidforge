"use client";

import { useEffect, useState } from "react";
import { PLANS, CREDIT_RATES } from "@vidforge/shared";

export default function AdminPlans() {
  const [ov, setOv] = useState<Record<string, Record<string, unknown> | undefined>>({}); const [msg, setMsg] = useState<string | null>(null);
  const load = () => fetch("/api/admin/config").then((r) => r.json()).then((d) => setOv(d.overrides ?? {}));
  useEffect(() => { load(); }, []);
  async function put(key: string, value: unknown) { const r = await fetch("/api/admin/config", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key, value }) }); setMsg(r.ok ? "Saved." : "Save failed."); load(); }
  const rates = { ...CREDIT_RATES, ...((ov["credit-rates"] as Partial<typeof CREDIT_RATES>) ?? {}) };
  return (
    <div className="space-y-8">
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-2">Plans — shown in USD everywhere; visitors in India are charged the INR price (UPI), everyone else the USD price</h2>
        <div className="overflow-x-auto rounded-xl border border-line">
          <table className="w-full text-sm">
            <thead className="bg-panel-2 text-left text-xs uppercase text-ink-3"><tr><th className="px-3 py-2">Plan</th><th className="px-3 py-2">Price $</th><th className="px-3 py-2">Price ₹ (India)</th><th className="px-3 py-2">Credits</th><th className="px-3 py-2">Script chars</th><th className="px-3 py-2">Popular</th><th className="px-3 py-2">Active</th><th className="px-3 py-2"></th></tr></thead>
            <tbody>{PLANS.map((p) => { const o = (ov[`plan:${p.id}`] ?? {}) as { priceInr?: number; priceUsd?: number; credits?: number; promptChars?: number; popular?: boolean; active?: boolean }; const cur = { priceUsd: o.priceUsd ?? p.priceUsd, priceInr: o.priceInr ?? p.priceInr, credits: o.credits ?? p.credits, promptChars: o.promptChars ?? p.promptChars, popular: o.popular ?? !!p.popular, active: o.active !== false }; return (
              <PlanRow key={p.id} id={p.id} name={p.name} cur={cur} edited={!!ov[`plan:${p.id}`]} onSave={(v) => put(`plan:${p.id}`, v)} onReset={() => put(`plan:${p.id}`, null)} />); })}</tbody>
          </table>
        </div>
      </section>
      <section>
        <h2 className="mb-3 text-sm font-medium text-ink-2">Credit rates</h2>
        <div className="panel grid gap-3 p-4 md:grid-cols-4">
          {Object.entries(rates).map(([k, v]) => <label key={k} className="text-sm"><span className="mb-1 block text-ink-3">{k}</span><input type="number" step="0.01" className="field" defaultValue={v} onBlur={(e) => { const n = Number(e.target.value); if (n !== v) put("credit-rates", { ...((ov["credit-rates"] as object) ?? {}), [k]: n }); }} /></label>)}
        </div>
        <div className="mt-2 flex items-center gap-3"><button className="btn-ghost text-sm" onClick={() => put("credit-rates", null)}>Reset rates to default</button>{msg && <span className="text-sm text-ink-3">{msg}</span>}</div>
      </section>
    </div>
  );
}

function PlanRow({ id, name, cur, edited, onSave, onReset }: { id: string; name: string; cur: { priceUsd: number; priceInr: number; credits: number; promptChars: number; popular: boolean; active: boolean }; edited: boolean; onSave: (v: unknown) => void; onReset: () => void }) {
  const [f, setF] = useState(cur);
  useEffect(() => setF(cur), [cur.priceUsd, cur.priceInr, cur.credits, cur.promptChars, cur.popular, cur.active]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <tr className="border-t border-line">
      <td className="px-3 py-2">{name} <span className="text-xs text-ink-3">{id}</span>{edited && <span className="chip ml-2">edited</span>}</td>
      <td className="px-3 py-2"><input type="number" className="field w-24" value={f.priceUsd / 100} onChange={(e) => setF({ ...f, priceUsd: Math.round(Number(e.target.value) * 100) })} /></td>
      <td className="px-3 py-2"><input type="number" className="field w-28" value={f.priceInr / 100} onChange={(e) => setF({ ...f, priceInr: Math.round(Number(e.target.value) * 100) })} /></td>
      <td className="px-3 py-2"><input type="number" className="field w-28" value={f.credits} onChange={(e) => setF({ ...f, credits: Number(e.target.value) })} /></td>
      <td className="px-3 py-2"><input type="number" className="field w-28" value={f.promptChars} onChange={(e) => setF({ ...f, promptChars: Number(e.target.value) })} /></td>
      <td className="px-3 py-2"><input type="checkbox" checked={f.popular} onChange={(e) => setF({ ...f, popular: e.target.checked })} /></td>
      <td className="px-3 py-2"><input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} /></td>
      <td className="px-3 py-2"><div className="flex gap-1"><button className="chip hover:border-accent" onClick={() => onSave(f)}>Save</button>{edited && <button className="chip" onClick={onReset}>Reset</button>}</div></td>
    </tr>
  );
}
