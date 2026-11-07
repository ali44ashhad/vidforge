import Reveal from "./Reveal";
import Backdrop from "./Backdrop";

export default function Section({ id, title, sub, children, className = "", action, depth = false, tone = "accent" }: { id?: string; title: React.ReactNode; sub?: string; children: React.ReactNode; className?: string; action?: React.ReactNode; depth?: boolean; tone?: "accent" | "blue" }) {
  return (
    <section id={id} className={`relative scroll-mt-20 py-14 md:py-24 ${className}`}>
      {depth && <Backdrop tone={tone} />}
      <div className="mx-auto max-w-7xl px-5 [perspective:1200px]">
        <Reveal className={`reveal-3d mb-8 md:mb-12 ${action ? "flex flex-wrap items-end justify-between gap-4" : "text-center"}`}>
          <div><h2 className="display text-[28px] font-bold leading-tight tracking-tight md:text-5xl">{title}</h2>{sub && <p className="mt-3 text-base text-ink-2 md:text-lg">{sub}</p>}</div>
          {action}
        </Reveal>
        <Reveal delay={120} className="reveal-3d">{children}</Reveal>
      </div>
    </section>
  );
}
