import Link from "next/link";

/** 앱 화면 상단 로고 — 누르면 소개(랜딩) 페이지로 */
export function AppLogo({ className = "" }: { className?: string }) {
  return (
    <Link
      href="/"
      aria-label="HumScore 홈(소개 페이지)"
      className={`inline-flex min-h-11 items-center gap-2 rounded-lg pr-2 text-sm font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/60 ${className}`}
    >
      {/* eslint-disable-next-line @next/next/no-img-element -- 정적 export: 최적화 불필요한 작은 SVG */}
      <img src="/icon.svg" alt="" width={28} height={28} className="size-7 rounded-md" />
      <span>HumScore</span>
    </Link>
  );
}
