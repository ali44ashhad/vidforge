export function Card({ children, className = "", title, action }: { children: React.ReactNode; className?: string; title?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={`rounded-2xl border border-line bg-panel ${className}`}>
      {(title || action) && <div className="flex items-center justify-between border-b border-line px-5 py-3.5"><h3 className="text-[15px] font-semibold">{title}</h3>{action}</div>}
      <div className="p-5">{children}</div>
    </div>
  );
}
export function MetricCard({ label, value, delta, hint }: { label: string; value: string; delta?: string; hint?: string }) {
  const up = delta && !delta.startsWith("-");
  return <div className="rounded-2xl border border-line bg-panel p-5"><div className="text-[13px] text-ink-3">{label}</div><div className="mt-1 flex items-baseline gap-2"><span className="display text-[28px] font-bold tabular-nums">{value}</span>{delta && <span className={`text-xs font-semibold ${up ? "text-success" : "text-danger"}`}>{delta}</span>}</div>{hint && <div className="mt-1 text-xs text-ink-3">{hint}</div>}</div>;
}
export function EmptyState({ title, sub, action, image }: { title: string; sub: string; action?: React.ReactNode; image?: string }) {
  return <div className="flex flex-col items-center rounded-2xl border border-dashed border-line-2 px-6 py-14 text-center">{image && <img src={image} alt="" className="mb-4 h-28" />}<h3 className="text-lg font-semibold">{title}</h3><p className="mt-1 max-w-sm text-sm text-ink-3">{sub}</p>{action && <div className="mt-5">{action}</div>}</div>;
}
export function Skeleton({ className = "" }: { className?: string }) { return <div className={`skeleton ${className}`} />; }
export function Tabs({ tabs, value, onChange }: { tabs: { id: string; label: string; count?: number }[]; value: string; onChange: (id: string) => void }) {
  return <div className="tabbar" role="tablist">{tabs.map((t) => <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}>{t.label}{t.count != null && <span className="ml-1.5 rounded-full bg-white/8 px-1.5 text-xs text-ink-3">{t.count}</span>}</button>)}</div>;
}
export function StatusPill({ status }: { status: string }) {
  const map: Record<string, [string, string]> = { COMPLETED: ["Ready", "pill-ready"], FAILED: ["Failed", "pill-failed"], PAUSED: ["Paused", "pill-draft"], QUEUED: ["Queued", "pill-generating"], DRAFT: ["Draft", "pill-draft"], PUBLISHED: ["Published", "pill-published"], SCHEDULED: ["Scheduled", "pill-scheduled"] };
  const [label, cls] = map[status] ?? ["Generating", "pill-generating"];
  return <span className={`pill ${cls}`}>{label}</span>;
}
