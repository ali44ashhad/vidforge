export default function PageHeader({ title, sub, action }: { title: React.ReactNode; sub?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div><h1 className="display text-[26px] font-bold tracking-tight md:text-[30px]">{title}</h1>{sub && <p className="mt-1 text-[15px] text-ink-2">{sub}</p>}</div>
      {action}
    </div>
  );
}
