import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, CircleCheck, Keyboard, Mic, ShieldCheck } from "lucide-react";
import { Icon } from "@/components/landing/icon";
import { CHECKS, FORMATS, NEW_FEATURES, PRODUCTS, SAMPLE_NOTES, STEPS, TOOLS, TRUST, TRY_CARDS, WHY } from "@/components/landing/data";
import { CompareDemo } from "@/components/landing/compare-demo";
import { EditorDemo } from "@/components/landing/editor-demo";
import { Faq } from "@/components/landing/faq";
import { Reveal } from "@/components/landing/reveal";
import styles from "@/components/landing/landing.module.css";

const DESCRIPTION =
  "마이크에 멜로디를 흥얼거리면 음표와 코드가 붙은 악보로 받아 적습니다. 원클릭 전조, 공연 모드, MIDI·MusicXML 내보내기.";

export const metadata: Metadata = {
  title: "HumScore — 흥얼거리면 악보가 됩니다",
  description: DESCRIPTION,
  openGraph: {
    title: "HumScore — 흥얼거리면 악보가 됩니다",
    description: DESCRIPTION,
    type: "website",
    locale: "ko_KR",
  },
};

const wrap = "mx-auto max-w-[var(--content-max)] px-5 md:px-[clamp(20px,5vw,72px)]";
const sectionPad = "py-[calc(var(--space-section)/2)] scroll-mt-[72px]";
const btnOutline = `${styles.btn} ${styles.btnOutline}`;
const btnGhost = `${styles.btn} ${styles.btnGhost}`;

/** --d: 스크롤 진입 지연(초) */
const delay = (s: number) => ({ "--d": `${s}s` }) as React.CSSProperties;

function SecHead({ kick, title, desc }: { kick: string; title: string; desc?: string }) {
  return (
    <div className={styles.secHead} data-reveal>
      <span className={styles.kicker}>{kick}</span>
      <h2 className={styles.h2}>{title}</h2>
      {desc && <p className={styles.lead}>{desc}</p>}
    </div>
  );
}

function Rule() {
  return <hr className={styles.rule} />;
}

export default function LandingPage() {
  return (
    <main className="break-keep">
      <Reveal />

      {/* 히어로 */}
      <section className={styles.hero}>
        <div className={styles.heroBg} aria-hidden>
          <svg className={styles.flow} viewBox="0 0 1600 700" preserveAspectRatio="none">
            <g>
              {[0, 16, 32, 48, 64].map((d) => (
                <path key={d} d={`M-80 ${420 + d} C 200 ${300 + d}, 420 ${560 + d}, 720 ${420 + d} S 1240 ${260 + d}, 1700 ${400 + d}`} />
              ))}
            </g>
          </svg>
          <span className={`${styles.bokeh} ${styles.b1}`} />
          <span className={`${styles.bokeh} ${styles.b2}`} />
          <span className={`${styles.bokeh} ${styles.b3}`} />
        </div>
        <div className={wrap}>
          <div className={styles.heroGrid}>
            <div className={styles.notes} aria-hidden>
              <span className={`${styles.fl} ${styles.f1}`}>♪</span>
              <span className={`${styles.fl} ${styles.f2}`}>♫</span>
              <span className={`${styles.fl} ${styles.f3}`}>𝄞</span>
              <span className={`${styles.fl} ${styles.f4}`}>♩</span>
              <span className={`${styles.fl} ${styles.f5}`}>♬</span>
            </div>
            <div className={styles.fadeIn}>
              <h1 className={styles.eyebrow}>허밍·건반 악보 변환</h1>
              <h2 className={styles.headline}>
                흥얼거리면
                <br />
                <em>악보가 됩니다.</em>
              </h2>
              <p className={styles.sub}>
                떠오른 멜로디를 불러 보세요. 음정을 따라가 음표와 코드를 붙이고 PDF · MIDI · MusicXML로 내보냅니다.
              </p>
              <div className={styles.btnRow}>
                <a className={btnOutline} href="#how">
                  작동 방식 <ArrowRight aria-hidden />
                </a>
                <div className={styles.entry}>
                  <Link href="/record" data-cta>
                    <Mic aria-hidden />
                    흥얼거려서 악보 만들기
                  </Link>
                  <Link href="/keys">
                    <Keyboard aria-hidden />
                    건반으로 입력하기
                  </Link>
                </div>
              </div>
              <p className={styles.heroNote}>가입 없이 바로 시작 · 목소리는 저장하지 않아요</p>
            </div>
            <DeviceMock />
          </div>
        </div>

        {/* 신뢰 띠: STATS 4 + 1 */}
        <div className={styles.trust} aria-label="HumScore 특징">
          <div className={wrap}>
            <ul>
              {TRUST.map((s) => (
                <li key={s.label}>
                  <AnchorOrLink href={s.href}>
                    <span className={styles.num}>{s.num}</span>
                    <span className={styles.lb}>{s.label}</span>
                  </AnchorOrLink>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      <div className={wrap}>
        {/* 3단계 */}
        <section id="how" className={sectionPad}>
          <SecHead kick="사용 방법" title="세 단계면 충분합니다" />
          <div className={styles.steps} data-reveal>
            {STEPS.map((s, i) => (
              <div key={s.num} className={styles.step} data-reveal style={delay(0.1 + i * 0.25)}>
                <div className={styles.ill}>
                  <Icon name={s.icon} />
                </div>
                <div>
                  <div className={styles.big}>{i + 1}.</div>
                  <h3>{s.title}</h3>
                  <p>{s.body}</p>
                </div>
              </div>
            ))}
          </div>
          <CompareDemo />
        </section>
        <Rule />

        {/* 체험 띠 */}
        <section id="try" className={sectionPad}>
          <div className={styles.try} data-reveal>
            <span className={styles.kicker}>지금 바로</span>
            <h2 className={styles.h2}>직접 경험해 보세요</h2>
            <p className={`${styles.lead} text-lavender-100`}>가입 없이 시작해서, 마음에 들면 로그인해 여러 기기에서 이어 보세요.</p>
            <div className={styles.cards}>
              {TRY_CARDS.map((c) => (
                <Link key={c.href} href={c.href} className={styles.ecard} data-cta={c.cta || undefined}>
                  <Icon name={c.icon} />
                  <span>
                    <b>{c.title}</b>
                    <small>{c.body}</small>
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
        <Rule />

        {/* 에디터 */}
        <section id="editor" className={sectionPad}>
          <div className="grid items-center gap-10 md:grid-cols-[5fr_7fr] md:gap-[clamp(32px,5vw,80px)]">
            <div data-reveal>
              <span className={styles.kicker}>에디터</span>
              <h2 className={styles.h2}>받아 적은 악보를 바로 다듬으세요</h2>
              <p className={styles.lead}>리드시트와 피아노 대보표를 오가며 음표와 코드를 고치고, 피아노 소리로 바로 확인합니다.</p>
              <ul className="mt-6 grid gap-3">
                {CHECKS.map((c) => (
                  <li key={c} className="flex items-start gap-2.5">
                    <CircleCheck className="mt-1 size-[18px] shrink-0 text-accent" aria-hidden />
                    {c}
                  </li>
                ))}
              </ul>
            </div>
            <div data-reveal style={delay(0.15)}>
              <EditorDemo />
            </div>
          </div>
        </section>
        <Rule />

        {/* 입력별 카드 그리드 */}
        <section id="products" className={sectionPad}>
          <SecHead kick="기능" title="멜로디를 악보로 만드는 도구" desc="녹음부터 연주까지, 악보 한 장을 완성하는 데 필요한 것만 담았습니다." />
          <div className={styles.grid}>
            {PRODUCTS.map((p, i) => (
              <article key={p.title} className={styles.card} data-reveal style={delay((i % 3) * 0.08)}>
                <Icon name={p.icon} />
                <h3>{p.title}</h3>
                <p>{p.body}</p>
                <AnchorOrLink href={p.href} className={btnGhost} label={`${p.title} 자세히`}>
                  자세히 <ArrowRight aria-hidden />
                </AnchorOrLink>
              </article>
            ))}
          </div>

          <h3 className={styles.subhead} data-reveal>
            <span className={styles.badge}>신규</span>새로 추가되는 기능
          </h3>
          <div className={styles.grid}>
            {NEW_FEATURES.map((f, i) => (
              <article key={f.id} className={`${styles.card} ${styles.cardNew}`} data-reveal style={delay(i * 0.08)}>
                <Icon name={f.icon} />
                <h3>
                  {f.title} <span className={styles.badge}>신규</span>
                </h3>
                <p>{f.card}</p>
                <a className={btnGhost} href={`#${f.id}`} aria-label={`${f.title} 자세히`}>
                  자세히 <ArrowRight aria-hidden />
                </a>
              </article>
            ))}
          </div>
        </section>
        <Rule />

        {/* 신규 기능 블록 3 */}
        <section id="new" className={sectionPad}>
          <SecHead kick="신규 기능" title="같은 악보를 더 많은 방식으로" desc="모두 브라우저 안에서 처리하며, 한 번에 한 멜로디(단선율)를 다룹니다." />
          {NEW_FEATURES.map((f, i) => (
            <div key={f.id} id={f.id} className={`${styles.fblock} ${i === 1 ? styles.rev : ""}`}>
              <div className={styles.fbText} data-reveal>
                <div className={styles.fbNum}>
                  <b>{i + 1}.</b>
                  <span className={styles.badge}>신규</span>
                </div>
                <h3>{f.heading}</h3>
                <p>{f.body}</p>
                {/* 화면이 아직 없어 비활성 */}
                <span className={`${btnOutline} ${styles.btnSoon}`} aria-disabled="true">
                  {f.cta} · 곧 제공
                </span>
              </div>
              <div className={styles.fbMedia} data-reveal style={delay(0.12)} aria-hidden>
                {i === 0 && <UploadMedia />}
                {i === 1 && <RollMedia />}
                {i === 2 && <TabMedia />}
              </div>
            </div>
          ))}
        </section>
        <Rule />

        {/* 숫자 띠·후기·언론·대상별 링크: 근거가 생기면 추가 (시안 [B] 주석 자리) */}

        {/* 호환 형식 */}
        <section id="formats" className={sectionPad}>
          <SecHead kick="내보내기" title="쓰던 프로그램 그대로" desc="MuseScore, Finale, Sibelius와 DAW에서 열 수 있습니다." />
          <div className={styles.fmts} data-reveal>
            {FORMATS.map((f) => (
              <div key={f.name} className={styles.fmt}>
                <Icon name={f.icon} />
                <div>
                  <b>{f.name}</b>
                  <small>{f.desc}</small>
                </div>
              </div>
            ))}
          </div>
          <div className={styles.tools} data-reveal>
            {TOOLS.map((t) => (
              <span key={t}>{t}</span>
            ))}
          </div>
        </section>
        <Rule />

        {/* 장점 6 */}
        <section id="why" className={sectionPad}>
          <SecHead kick="장점" title="HumScore가 편한 이유" />
          <div className={styles.why}>
            {WHY.map((w, i) => (
              <div key={w.title} data-reveal style={delay((i % 3) * 0.08)}>
                <Icon name={w.icon} />
                <h3>{w.title}</h3>
                <p>{w.body}</p>
              </div>
            ))}
          </div>
        </section>
        <Rule />

        {/* 개인정보 */}
        <section id="privacy" className={sectionPad}>
          <div className="flex flex-col gap-5 md:flex-row md:items-start md:gap-8" data-reveal>
            <ShieldCheck className="size-10 shrink-0 text-accent" aria-hidden />
            <div className="max-w-[640px]">
              <span className={styles.kicker}>개인정보</span>
              <h2 className={styles.h2}>목소리는 기기 밖으로 나가지 않아요</h2>
              <p className={styles.lead}>
                마이크 소리는 기기 안에서 바로 음표 숫자로 바뀌고, 녹음 파일은 만들지도 저장하지도 않습니다. 로그인하면 악보 데이터만 내 계정에 동기화됩니다.
              </p>
            </div>
          </div>
        </section>

        {/* 요금 */}
        <section id="pricing" className={`${sectionPad} pt-0!`}>
          <div className={styles.price} data-reveal>
            <b>허밍은 무료</b>
            <a href="#faq-free">요금 자세히 보기 →</a>
          </div>
        </section>
        <Rule />

        {/* FAQ */}
        <section id="faq" className={sectionPad}>
          <SecHead kick="FAQ" title="자주 묻는 질문" />
          <div data-reveal>
            <Faq />
          </div>
        </section>
        <Rule />

        {/* 마감 CTA */}
        <section id="close" className={sectionPad}>
          <div data-reveal>
            <h2 className={styles.closeTitle}>오늘 떠오른 멜로디, 지금 악보로.</h2>
            <p className={styles.lead}>가입 없이 바로 시작하세요.</p>
            <div className="mt-6 flex flex-wrap gap-2.5">
              <Link href="/library" data-cta className={`${styles.btn} ${styles.btnSolid}`}>
                <ArrowRight aria-hidden />
                바로 시작하기
              </Link>
              <Link href="/record" className={btnOutline}>
                흥얼거려 보기
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}

/** 히어로 기기 목업: 노트북(악보 화면) + 휴대폰(내 악보 목록). 모바일에서는 숨김 */
function DeviceMock() {
  return (
    <div className={styles.mock} aria-hidden>
      <div className={styles.laptop}>
        <div className={styles.lid}>
          <div className={styles.scr}>
            <div className={styles.bar}>
              <i />
              <i />
              <i />
              <b>HumScore · 아침 산책</b>
            </div>
            <div className={styles.tabsM}>
              <span className={styles.on}>편집</span>
              <span>코드</span>
              <span>전조</span>
              <span>공연</span>
            </div>
            <div className={styles.paper}>
              <div className={styles.sheet}>
                <Image src="/landing/hero-score.svg" alt="" width={1240} height={904} className={styles.sheetImg} unoptimized priority />
                <span className={styles.playhead} />
              </div>
            </div>
            <div className={styles.trans}>
              <span className={styles.pl}>▶</span>
              <span className={styles.pg}>
                <i />
              </span>
              <span>G장조 · 4/4 · 12마디</span>
            </div>
          </div>
        </div>
        <div className={styles.base} />
      </div>
      <div className={styles.phone}>
        <div className={styles.pscr}>
          <h5>내 악보</h5>
          {[
            ["아침 산책", "G장조 · 4/4"],
            ["저녁 하모니", "G장조 · 3/4"],
            ["연습곡", "F장조 · 4/4"],
            ["떠오른 멜로디", "D장조 · 4/4"],
          ].map(([t, m]) => (
            <div key={t} className={styles.prow}>
              <span className={styles.th} />
              <span>
                <b>{t}</b>
                <small>{m}</small>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** 작은 오선 악보: SAMPLE_NOTES 9음(C장조). y 20(위선)~60(아랫선) */
function MiniStaff({ w = 360 }: { w?: number }) {
  const x0 = 76;
  const st = (w - x0 - 24) / SAMPLE_NOTES.length;
  return (
    <svg viewBox={`0 0 ${w} 92`} className={styles.miniStaff}>
      <g transform="translate(0,20)" fill="currentColor" stroke="currentColor">
        {[0, 1, 2, 3, 4].map((i) => (
          <line key={i} x1={10} x2={w - 10} y1={20 + i * 10} y2={20 + i * 10} strokeWidth={1} opacity={0.7} />
        ))}
        <text x={12} y={58} fontSize={52} fontFamily="serif" stroke="none">
          𝄞
        </text>
        {SAMPLE_NOTES.map((n, i) => {
          const x = x0 + i * st;
          const up = n.y >= 40;
          const sx = up ? x + 5.4 : x - 5.4;
          return (
            <g key={i}>
              <ellipse cx={x} cy={n.y} rx={6.2} ry={4.6} transform={`rotate(-20 ${x} ${n.y})`} stroke="none" />
              <line x1={sx} x2={sx} y1={n.y} y2={up ? n.y - 28 : n.y + 28} strokeWidth={1.2} />
              {i % 3 === 0 && i > 0 && <line x1={x - st / 2 - 2} x2={x - st / 2 - 2} y1={20} y2={60} strokeWidth={1} />}
            </g>
          );
        })}
        <line x1={w - 12} x2={w - 12} y1={20} y2={60} strokeWidth={2.2} />
      </g>
    </svg>
  );
}

const WAVE = Array.from({ length: 36 }, (_, i) => ({
  "--h": `${(18 + Math.abs(Math.sin(i * 0.7)) * 70).toFixed(1)}%`,
  "--dl": `${(i * 0.05).toFixed(2)}s`,
})) as React.CSSProperties[];

function UploadMedia() {
  return (
    <>
      <div className={styles.upl}>
        오디오 파일을 여기에 놓기<small>단선율 · 브라우저에서 처리</small>
      </div>
      <div className={styles.wave}>
        {WAVE.map((s, i) => (
          <i key={i} style={s} />
        ))}
      </div>
      <MiniStaff />
    </>
  );
}

function RollMedia() {
  const notes = [
    [54, 102, 52],
    [112, 88, 52],
    [170, 74, 68],
    [244, 60, 52],
    [302, 46, 44],
  ];
  return (
    <svg className={styles.roll} viewBox="0 0 360 170">
      <rect className={styles.key} x="0" y="0" width="38" height="170" />
      {[20, 48, 90, 118, 146].map((y) => (
        <rect key={y} className={`${styles.key} ${styles.blk}`} x="0" y={y} width="24" height="14" />
      ))}
      {[28, 56, 84, 112, 140].map((y) => (
        <line key={y} x1="38" y1={y} x2="360" y2={y} />
      ))}
      {notes.map(([x, y, w], i) => (
        <rect key={x} className={styles.n} x={x} y={y} width={w} height="20" rx="4" style={{ "--d": `${i * 0.3}s` } as React.CSSProperties} />
      ))}
    </svg>
  );
}

function TabMedia() {
  const strings = ["e", "B", "G", "D", "A", "E"];
  const frets: Array<[number, number, string]> = [
    [50, 86, "0"],
    [92, 68, "2"],
    [134, 68, "4"],
    [176, 50, "0"],
    [218, 68, "4"],
    [260, 68, "2"],
    [302, 86, "0"],
  ];
  return (
    <svg className={styles.tab} viewBox="0 0 360 150">
      {strings.map((s, i) => (
        <text key={s + i} className={styles.lbl} x="2" y={32 + i * 18}>
          {s}
        </text>
      ))}
      {strings.map((s, i) => (
        <line key={`l${i}`} x1="18" y1={28 + i * 18} x2="350" y2={28 + i * 18} />
      ))}
      {frets.map(([x, y, f]) => (
        <text key={x} x={x} y={y}>
          {f}
        </text>
      ))}
    </svg>
  );
}

function AnchorOrLink({
  href,
  className,
  label,
  children,
}: {
  href: string;
  className?: string;
  label?: string;
  children: React.ReactNode;
}) {
  return href.startsWith("#") ? (
    <a href={href} className={className} aria-label={label}>
      {children}
    </a>
  ) : (
    <Link href={href} className={className} aria-label={label}>
      {children}
    </Link>
  );
}
