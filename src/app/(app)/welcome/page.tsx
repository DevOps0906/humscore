"use client";
import { Suspense } from "react";

import { useRouter } from "next/navigation";
import { Mic } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const STATS = [
  { num: "88건반", label: "피아노 건반 입력" },
  { num: "12키", label: "원클릭 전조" },
  { num: "9종", label: "MIDI 악기" },
  { num: "3가지", label: "내보내기 (PDF · MIDI · MusicXML)" },
];

const STEPS = [
  { n: "01", title: "흥얼거리거나 건반으로 입력", body: "마이크에 대고 멜로디를 흥얼거리거나, 88건반을 눌러 음표를 적어요." },
  { n: "02", title: "음표·코드 다듬기", body: "음 길이와 음표를 고치고 코드를 골라 나만의 코드 악보로 정리해요." },
  { n: "03", title: "전조하고 내보내기", body: "원클릭으로 키를 옮기고 PDF, MIDI, MusicXML로 저장해요." },
];

function WelcomePageInner() {
  const router = useRouter();
  const start = () => {
    router.replace("/library");
  };

  return (
    <div className="flex flex-col gap-16 pb-8 md:gap-24">
      <section className="grid items-center gap-8 pt-6 md:grid-cols-[minmax(0,1fr)_minmax(0,420px)] md:gap-14 md:pt-16">
        <div>
          <p className="mb-4 text-sm font-medium text-accent">HumScore</p>
          <h1 className="mb-5 text-[clamp(38px,6vw,64px)] font-medium leading-[1.1] tracking-[-0.025em]">
            <span className="block">흥얼거리면</span>
            <span className="block">악보가 돼요.</span>
          </h1>
          <p className="mb-7 max-w-[46ch] text-base leading-relaxed text-ink-soft">
            허밍을 녹음하거나 88건반으로 입력하면 코드 악보가 만들어져요. 원클릭 전조는 물론 MIDI·MusicXML·PDF로 내보낼 수 있어요.
          </p>
          <Button type="button" onClick={start} className="h-11 px-6 text-sm">
            시작하기
          </Button>
        </div>

        <Card className="gap-4 p-5 shadow-md">
          <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-line px-5 py-8 text-center">
            <span className="text-accent"><Mic className="size-9" strokeWidth={1.8} aria-hidden /></span>
            <strong className="font-medium">떠오른 멜로디를 흥얼거려 보세요</strong>
            <small className="text-xs text-ink-soft">30초면 코드 악보가 만들어져요</small>
          </div>
          <p className="text-center text-xs text-ink-soft">목소리는 저장·전송하지 않고 음표만 남겨요.</p>
        </Card>
      </section>

      <section
        aria-label="HumScore 기능 수치"
        className="-mx-4 px-4 py-12 md:-mx-8 md:px-8"
        style={{ background: "radial-gradient(900px 420px at 85% -40%, rgba(145,132,217,0.28), transparent 64%), #262a60" }}
      >
        <div className="mx-auto grid max-w-5xl grid-cols-2 gap-8 md:grid-cols-4">
          {STATS.map((s) => (
            <div key={s.num}>
              <p className="mb-2 text-[clamp(28px,3.4vw,44px)] font-medium leading-none tracking-tight">{s.num}</p>
              <p className="text-[13px] text-ink/70">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-8 text-[clamp(26px,3vw,34px)]">세 단계면 충분해요</h2>
        <div className="grid gap-8 md:grid-cols-3 md:gap-12">
          {STEPS.map((s) => (
            <div key={s.n}>
              <div className="mb-3.5 flex items-center gap-3 text-sm text-accent tabular-nums">
                {s.n}
                <span className="hr-fade flex-1" aria-hidden />
              </div>
              <h3 className="mb-2 text-xl">{s.title}</h3>
              <p className="text-[15px] leading-relaxed text-ink-soft">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      <div className="hr-fade" aria-hidden />

      <section>
        <h2 className="mb-3 text-[clamp(28px,3.6vw,40px)]">오늘 떠오른 멜로디, 지금 악보로.</h2>
        <p className="mb-6 text-sm text-ink-soft">목소리는 저장·전송하지 않고 음표만 남겨요.</p>
        <Button type="button" onClick={start} className="h-11 w-full px-6 text-sm md:w-auto">
          시작하기
        </Button>
      </section>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense fallback={null}>
      <WelcomePageInner />
    </Suspense>
  );
}
