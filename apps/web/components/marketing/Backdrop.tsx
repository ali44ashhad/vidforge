import Parallax from "./Parallax";

/** Layered depth behind a section: two parallax orbs at different speeds plus a faint grid. */
export default function Backdrop({ tone = "accent" }: { tone?: "accent" | "blue" }) {
  const c = tone === "blue" ? "rgba(71,118,255,.28)" : "rgba(115,87,255,.28)";
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,.035)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.035)_1px,transparent_1px)] bg-[size:48px_48px] [mask-image:radial-gradient(60%_50%_at_50%_40%,#000,transparent)]" />
      <Parallax speed={0.18} className="absolute -left-40 top-10 h-[420px] w-[420px] rounded-full blur-3xl" ><div className="h-full w-full rounded-full" style={{ background: `radial-gradient(closest-side, ${c}, transparent)` }} /></Parallax>
      <Parallax speed={-0.12} className="absolute -right-32 bottom-0 h-[360px] w-[360px] rounded-full blur-3xl"><div className="h-full w-full rounded-full" style={{ background: "radial-gradient(closest-side, rgba(169,106,255,.22), transparent)" }} /></Parallax>
    </div>
  );
}
