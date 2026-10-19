import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CircleCheck, Keyboard, Library, Mic, Plus, Star, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/landing/icon";
import { CHECKS, FAQS, FORMATS, PRODUCTS, QUOTES, STATS, STEPS } from "@/components/landing/data";
import styles from "@/components/landing/landing.module.css";

export const metadata: Metadata = {
  title: "HumScore — 모든 음악을 악보로 바꿔보세요",
  description:
    "오디오 파일이나 YouTube 링크를 올리면 AI가 몇 분 안에 악보, 기타 탭, MIDI로 받아 적어 드립니다. 악기별로 분리해 채보하고 에디터에서 바로 다듬으세요.",
  openGraph: {
    title: "HumScore — 모든 음악을 악보로 바꿔보세요",
    description: "AI가 몇 분 안에 악보, 기타 탭, MIDI로 받아 적어 드립니다.",
    type: "website",
    locale: "ko_KR",
  },
};

const wrap = "mx-auto max-w-[1200px] px-5 md:px-[clamp(20px,5vw,72px)]";
const sectionPad = "py-16 md:py-24";
const kicker = "mb-3 block text-xs uppercase tracking-[0.08em] text-accent";
const h2 = "mb-3 text-[clamp(28px,3vw,36px)] font-semibold leading-tight tracking-tight";

function SecHead({ kick, title, desc }: { kick: string; title: string; desc?: string }) {
  return (
    <div className="mb-10 max-w-[640px]">
      <span className={kicker}>{kick}</span>
      <h2 className={h2}>{title}</h2>
      {desc && <p className="text-base text-ink/70">{desc}</p>}
    </div>
  );
}

function Rule() {
  return <hr className={styles.rule} />;
}

export default function LandingPage() {
  return (
    <main>
      {/* hero */}
      <div className={wrap}>
        <section className="grid items-center gap-10 pb-16 pt-12 md:grid-cols-[minmax(0,1fr)_minmax(0,460px)] md:gap-16 md:pb-24 md:pt-20">
          <div>
            <h1 className="mb-5 text-[clamp(36px,5.4vw,72px)] font-semibold leading-[1.1] tracking-[-0.025em]">
              <span className="block">모든 음악을</span>
              <span className="block">악보로 바꿔보세요.</span>
            </h1>
            <p className="mb-7 max-w-[46ch] text-[17px] leading-relaxed text-ink/70">
              오디오 파일이나 YouTube 링크를 올리면 AI가 몇 분 안에 악보, 기타 탭, MIDI로 받아 적어 드립니다. 피아노부터 보컬, 드럼까지 악기별로
              분리해 채보합니다.
            </p>
            <div className="flex items-center gap-3 text-[13px]">
              <span className="flex gap-0.5 text-accent" aria-hidden>
                {Array.from({ length: 5 }, (_, i) => (
                  <Star key={i} className="size-3.5 fill-current" />
                ))}
              </span>
              <span className="text-ink/70">4.8 · 리뷰 12,000+개</span>
            </div>
          </div>
          <div className={`${styles.heroGlow} flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-[var(--shadow-md)]`}>
            <p className="text-xs text-ink-soft">지금 바로 시작하기</p>
            <Link href="/record" className="flex items-center gap-4 rounded-lg border border-line p-4 transition-colors hover:border-accent hover:bg-accent/10">
              <Mic className="size-8 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <strong className="block font-medium">흥얼거려서 악보 만들기</strong>
                <small className="text-xs text-ink-soft">마이크로 허밍하면 음표로 받아 적습니다</small>
              </span>
            </Link>
            <Link href="/keys" className="flex items-center gap-4 rounded-lg border border-line p-4 transition-colors hover:border-accent hover:bg-accent/10">
              <Keyboard className="size-8 shrink-0 text-accent" aria-hidden />
              <span className="min-w-0">
                <strong className="block font-medium">건반으로 입력하기</strong>
                <small className="text-xs text-ink-soft">화면 피아노로 직접 음을 찍어 보세요</small>
              </span>
            </Link>
            <Button asChild size="lg" className="mt-1 h-10 text-[15px]">
              <Link href="/library">
                <Library aria-hidden />내 악보 보기
              </Link>
            </Button>
          </div>
        </section>
      </div>

      {/* stats */}
      <section className={`${styles.stats} py-14`} aria-label="HumScore 숫자로 보기">
        <div className={`${wrap} grid grid-cols-2 gap-8 md:grid-cols-4`}>
          {STATS.map((s) => (
            <div key={s.label}>
              <p className="mb-2.5 text-[clamp(34px,3.4vw,48px)] font-medium leading-none tracking-tight">{s.num}</p>
              <p className="text-[13px] text-ink/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <div className={wrap}>
        {/* products */}
        <section id="products" className={sectionPad}>
          <SecHead kick="제품" title="악기마다 맞춘 채보 도구" desc="각 악기의 음색과 연주법을 따로 학습한 모델이 음표, 리듬, 운지까지 받아 적습니다." />
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {PRODUCTS.map((p) => (
              <Card key={p.title} className="gap-2.5 p-[22px] transition-shadow hover:shadow-[var(--shadow-md)]">
                <Icon name={p.icon} className="size-7 text-accent" />
                <h3 className="text-lg font-semibold">{p.title}</h3>
                <p className="text-sm leading-relaxed text-ink/70">{p.body}</p>
                <Button asChild variant="ghost" className="mt-1 self-start">
                  <Link href={p.href}>
                    자세히 <ArrowRight aria-hidden />
                  </Link>
                </Button>
              </Card>
            ))}
          </div>
        </section>
        <Rule />

        {/* how */}
        <section id="how" className={sectionPad}>
          <SecHead kick="사용 방법" title="세 단계면 충분합니다" />
          <div className="grid gap-8 md:grid-cols-3 md:gap-[clamp(24px,4vw,56px)]">
            {STEPS.map((s) => (
              <div key={s.num}>
                <div className={`${styles.stepLine} mb-3.5 flex items-center gap-3 text-sm tabular-nums text-accent`}>{s.num}</div>
                <h3 className="mb-2 text-[21px] font-semibold">{s.title}</h3>
                <p className="text-[15px] leading-relaxed text-ink/70">{s.body}</p>
              </div>
            ))}
          </div>
        </section>
        <Rule />

        {/* editor */}
        <section id="editor" className={sectionPad}>
          <div className="grid items-center gap-10 md:grid-cols-[5fr_7fr] md:gap-[clamp(32px,5vw,80px)]">
            <div>
              <span className={kicker}>에디터</span>
              <h2 className={h2}>받아 적은 악보를 바로 다듬으세요</h2>
              <p className="text-base leading-[1.7] text-ink/70">원곡과 악보를 나란히 재생하며 틀린 음을 고치고, 템포를 늦춰 연습할 수 있습니다.</p>
              <ul className="mt-6 flex flex-col gap-3 text-[15px]">
                {CHECKS.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <CircleCheck className="mt-0.5 size-[18px] shrink-0 text-accent" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <EditorMock />
          </div>
        </section>
        <Rule />

        {/* formats */}
        <section className={sectionPad}>
          <SecHead kick="내보내기" title="쓰던 프로그램 그대로" desc="MuseScore, Finale, Sibelius, Guitar Pro, DAW 어디서든 열 수 있습니다." />
          <div className="flex flex-wrap gap-2.5">
            {FORMATS.map((f) => (
              <div key={f.name} className="flex min-w-[200px] flex-1 items-center gap-3 rounded-lg bg-surface px-[18px] py-3.5">
                <Icon name={f.icon} className="size-[22px] text-accent" />
                <div>
                  <b className="block text-[15px] font-medium">{f.name}</b>
                  <small className="text-xs text-ink-soft">{f.desc}</small>
                </div>
              </div>
            ))}
          </div>
        </section>
        <Rule />

        {/* users */}
        <section className={sectionPad}>
          <SecHead kick="사용자 후기" title="연주자, 선생님, 작곡가가 씁니다" />
          <div className="grid gap-3 md:grid-cols-3">
            {QUOTES.map((q) => (
              <Card key={q.who} className="p-6">
                <figure className="flex flex-col gap-4">
                  <blockquote className="text-base leading-relaxed">“{q.text}”</blockquote>
                  <figcaption className="text-[13px] text-ink-soft">{q.who}</figcaption>
                </figure>
              </Card>
            ))}
          </div>
        </section>
        <Rule />

        {/* faq */}
        <section id="faq" className={sectionPad}>
          <SecHead kick="FAQ" title="자주 묻는 질문" />
          <div className="max-w-[820px]">
            {FAQS.map((f, i) => (
              <details key={f.q} open={i === 0} className={`${styles.faqItem} py-5`}>
                <summary className="flex cursor-pointer items-center justify-between gap-4 text-[17px] font-medium">
                  {f.q}
                  <Plus className={`${styles.plus} size-5 shrink-0 text-accent transition-transform`} aria-hidden />
                </summary>
                <p className="mt-3 max-w-[64ch] text-[15px] leading-[1.7] text-ink/70">{f.a}</p>
              </details>
            ))}
          </div>
        </section>
        <Rule />

        {/* close */}
        <section className={sectionPad}>
          <h2 className="mb-3.5 text-[clamp(30px,3.6vw,44px)] font-semibold leading-tight tracking-tight">오늘 연습할 곡, 지금 악보로.</h2>
          <p className="text-base text-ink/70">카드 등록 없이 시작하세요.</p>
          <div className="mt-6 flex flex-wrap gap-2.5">
            <Button asChild className="h-[42px] px-[18px] text-[15px]">
              <Link href="/library">
                <Upload aria-hidden />
                음악 올리기
              </Link>
            </Button>
            <Button asChild variant="secondary" className="h-[42px] px-[18px] text-[15px]">
              <Link href="/record">흥얼거려 보기</Link>
            </Button>
          </div>
        </section>
      </div>
    </main>
  );
}

const STAFF_Y = [40, 52, 64, 76, 88];
const NOTES: ReadonlyArray<readonly [number, number]> = [
  [70, 76], [110, 64], [150, 58], [190, 70], [230, 52], [270, 64], [310, 76], [350, 46], [390, 58], [430, 70],
];

function EditorMock() {
  return (
    <div className="aspect-[16/10] w-full overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-sm)]" role="img" aria-label="에디터 화면 예시">
      <svg viewBox="0 0 480 300" className="size-full" aria-hidden>
        <rect x="16" y="16" width="448" height="28" rx="6" fill="var(--tono-bg)" />
        <circle cx="34" cy="30" r="5" fill="var(--tono-accent)" />
        <rect x="50" y="26" width="120" height="8" rx="4" fill="var(--tono-gray-700)" />
        <rect x="16" y="56" width="448" height="228" rx="8" fill="var(--score-paper)" />
        {[0, 1].map((r) => (
          <g key={r} transform={`translate(0 ${r * 100 + 20})`}>
            {STAFF_Y.map((y) => (
              <line key={y} x1="40" x2="440" y1={y} y2={y} stroke="#9397ab" strokeWidth="1" />
            ))}
            {NOTES.map(([x, y], i) => {
              const cy = y + (r ? 6 : 0);
              const color = r === 0 && i === 4 ? "var(--tono-accent)" : "#161826";
              return (
                <g key={i}>
                  <ellipse cx={x} cy={cy} rx="6" ry="4.5" fill={color} />
                  <line x1={x + 5.5} x2={x + 5.5} y1={cy} y2={cy - 26} stroke={color} />
                </g>
              );
            })}
          </g>
        ))}
      </svg>
    </div>
  );
}
