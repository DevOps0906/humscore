import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { LandingNav } from "@/components/landing/landing-nav";
import { StickyCta } from "@/components/landing/sticky-cta";
import styles from "@/components/landing/landing.module.css";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${styles.body} flex-1 text-ink`}>
      <header className="sticky top-0 z-10 border-b border-line bg-paper/80 backdrop-blur-md">
        <div className="mx-auto flex max-w-[var(--content-max)] flex-wrap items-center gap-x-4 gap-y-0 px-5 md:gap-x-5 md:px-[clamp(20px,5vw,72px)]">
          <Link href="/" className="mr-auto flex min-h-14 items-center gap-2 font-semibold">
            <AudioLines className="size-5 text-accent" aria-hidden />
            HumScore
          </Link>
          <LandingNav />
          <Link href="/login" className="inline-flex min-h-[var(--tap-min)] items-center text-sm text-ink-soft hover:text-ink">
            로그인
          </Link>
          <Button asChild size="lg" className="min-h-[var(--tap-min)]">
            <Link href="/library">무료로 시작</Link>
          </Button>
        </div>
      </header>
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
