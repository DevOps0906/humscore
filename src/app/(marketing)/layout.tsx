import Link from "next/link";
import { Library } from "lucide-react";
import { LandingNav } from "@/components/landing/landing-nav";
import { StickyCta } from "@/components/landing/sticky-cta";
import styles from "@/components/landing/landing.module.css";

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
      <footer className="mx-auto flex max-w-[var(--content-max)] flex-wrap justify-between gap-4 px-5 pb-24 md:pb-14 pt-10 text-sm text-ink-soft md:px-[clamp(20px,5vw,72px)]">
        <span>© 2026 HumScore</span>
        <nav className="flex flex-wrap gap-5" aria-label="푸터">
          <Link href="/terms" className="hover:text-accent">
            이용약관
          </Link>
          <Link href="/privacy" className="hover:text-accent">
            개인정보처리방침
          </Link>
        </nav>
      </footer>
      <StickyCta />
    </div>
  );
}
