import Link from "next/link";
import { AudioLines } from "lucide-react";
import { Button } from "@/components/ui/button";
import { NAV_LINKS } from "@/components/landing/data";
import styles from "@/components/landing/landing.module.css";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className={`${styles.body} flex-1 text-ink`}>
      <header className="sticky top-0 z-10 bg-paper/80 backdrop-blur-md">
        <nav className="mx-auto flex h-14 max-w-[1200px] items-center gap-5 px-5 md:px-[clamp(20px,5vw,72px)]" aria-label="주 메뉴">
          <Link href="/" className="mr-auto flex items-center gap-2 font-semibold">
            <AudioLines className="size-5 text-accent" aria-hidden />
            HumScore
          </Link>
          {NAV_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="hidden text-sm text-ink-soft hover:text-ink md:block">
              {l.label}
            </a>
          ))}
          <Link href="/login" className="text-sm text-ink-soft hover:text-ink">
            로그인
          </Link>
          <Button asChild size="lg">
            <Link href="/library">무료로 시작</Link>
          </Button>
        </nav>
      </header>
      {children}
      <footer className="mx-auto flex max-w-[1200px] flex-wrap justify-between gap-4 px-5 pb-14 pt-10 text-[13px] text-ink-soft md:px-[clamp(20px,5vw,72px)]">
        <span>© 2026 HumScore</span>
        <nav className="flex flex-wrap gap-5" aria-label="푸터">
          {["이용약관", "개인정보처리방침", "고객센터", "블로그"].map((t) => (
            <a key={t} href="#" className="hover:text-accent">
              {t}
            </a>
          ))}
        </nav>
      </footer>
    </div>
  );
}
