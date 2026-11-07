import Link from "next/link";

/** Y2ube wordmark + symbol (from the brand kit). */
export default function Logo({ compact = false, href = "/" }: { compact?: boolean; href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 font-semibold" aria-label="Y2ube">
      <svg viewBox="0 0 56 56" width="30" height="30" aria-hidden><rect width="56" height="56" rx="16" fill="#5B5AF7" /><path d="M18 16.5v23l21-11.5L18 16.5Z" fill="white" /><path d="M29 18c7 1 12 5 12 10s-5 9-12 10" fill="none" stroke="#FFB84D" strokeWidth="3" strokeLinecap="round" /></svg>
      {!compact && <span className="display text-lg tracking-tight">Y2ube</span>}
    </Link>
  );
}
