"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Coins } from "lucide-react";

type Est = { credits: number; reserve: number; breakdown: { label: string; credits: number }[]; clips: number; images: number };

/** Live credit estimate for the current form settings (debounced). */
export default function EstimateCard({ settings }: { settings: Record<string, unknown> }) {
  const [data, setData] = useState<{ estimate: Est; balance: number | null; enough: boolean | null } | null>(null);
  const [open, setOpen] = useState(false);
  const key = JSON.stringify(settings);
  useEffect(() => {
    const t = setTimeout(async () => {
      const res = await fetch("/api/projects/estimate", { method: "POST", headers: { "Content-Type": "application/json" }, body: key });
      if (res.ok) setData(await res.json());
    }, 400);
    return () => clearTimeout(t);
  }, [key]);
  if (!data) return null;
  const { estimate, balance, enough } = data;
  return (
    <div className={`rounded-xl border p-4 text-sm ${enough === false ? "border-warning/60 bg-warning/5" : "border-line"}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2"><Coins size={16} className="text-warning" /><span className="font-medium">About {estimate.credits} credits</span><span className="text-ink-3">(reserves {estimate.reserve})</span></div>
        <button type="button" className="text-xs text-ink-3 hover:text-ink" onClick={() => setOpen(!open)}>{open ? "Hide" : "Details"}</button>
      </div>
      {open && <ul className="mt-2 space-y-0.5 text-xs text-ink-3">{estimate.breakdown.map((b) => <li key={b.label} className="flex justify-between"><span>{b.label}</span><span>{b.credits}</span></li>)}</ul>}
      {balance !== null && (
        <p className={`mt-2 text-xs ${enough ? "text-ink-3" : "text-warning"}`}>
          {enough ? `You have ${balance.toLocaleString()} credits.` : <>You need about {estimate.reserve - balance} more credits. <Link href="/billing" className="underline">Get credits</Link></>}
        </p>
      )}
    </div>
  );
}
