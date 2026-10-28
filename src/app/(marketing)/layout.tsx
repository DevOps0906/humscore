import Link from "next/link";
import { Library } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { StickyCta } from "@/components/landing/sticky-cta";
import styles from "@/components/landing/landing.module.css";

/** 푸터 링크 열: [문구, 경로]. 랜딩 앵커는 약관 화면에서도 닿도록 "/#..." */
const FOOTER_COLS: ReadonlyArray<{ title: string; links: ReadonlyArray<readonly [string, string]> }> = [
  {
    title: "제품",
    links: [
      ["녹음", "/record"],
      ["건반 입력", "/keys"],
      ["내 악보", "/library"],
      ["에디터", "/#editor"],
    ],
  },
  {
    title: "도움말",
    links: [
      ["사용 방법", "/#how"],
      ["FAQ", "/#faq"],
      ["요금", "/#pricing"],
    ],
  },
  {
    title: "법률",
    links: [
      ["개인정보처리방침", "/privacy"],
      ["이용약관", "/terms"],
    ],
  },
];

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${styles.body} flex-1 text-ink`}>
      <header className={styles.header}>
        <div className="mx-auto flex h-full max-w-[var(--content-max)] items-center gap-x-3 px-5 md:gap-x-4 md:px-[clamp(20px,5vw,72px)]">
          <Link href="/" className="mr-auto flex min-h-[var(--tap-min)] items-center gap-2 text-lg font-bold tracking-tight">
            <i className={styles.logoDot} aria-hidden />
            HumScore
          </Link>
          <LandingNav />
          <Link href="/login" className="inline-flex min-h-[var(--tap-min)] items-center text-sm text-ink-soft hover:text-ink">
            로그인
          </Link>
          <Link href="/library" className={`${styles.btn} ${styles.btnOutline} ${styles.navBtn}`}>
            <Library aria-hidden />
            내 악보 보기
          </Link>
        </div>
      </header>
      <div className={styles.headerSpacer} aria-hidden />
      {children}
      <footer className="mx-auto max-w-[var(--content-max)] px-5 pb-24 pt-10 text-sm text-ink-soft md:px-[clamp(20px,5vw,72px)] md:pb-14">
        <div className="grid grid-cols-2 gap-x-6 gap-y-8 md:grid-cols-3 lg:grid-cols-[minmax(0,1.6fr)_repeat(3,minmax(0,1fr))]">
          <div className="col-span-2 md:col-span-3 lg:col-span-1">
            <Link href="/" className="inline-flex min-h-[var(--tap-min)] items-center gap-2 text-lg font-bold tracking-tight text-ink">
              <i className={styles.logoDot} aria-hidden />
              HumScore
            </Link>
            <p className="mt-2 max-w-[36ch]">흥얼거리면 악보가 됩니다. 녹음부터 편집·내보내기까지 브라우저 하나로.</p>
          </div>
          {FOOTER_COLS.map((col) => (
            <nav key={col.title} aria-label={`푸터 ${col.title}`}>
              <h2 className="mb-3 font-semibold text-ink">{col.title}</h2>
              <ul className="grid gap-1">
                {col.links.map(([label, href]) => (
                  <li key={href}>
                    <Link href={href} className="inline-flex min-h-[var(--tap-min)] items-center hover:text-accent">
                      {label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-line pt-6 text-xs md:flex-row md:justify-between md:gap-6">
          <span>© 2026 HumScore</span>
          <span>표시된 상표와 로고는 각 소유자의 자산이며 호환성 안내 목적입니다.</span>
        </div>
      </footer>
      <StickyCta />
    </div>
  );
}
