"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileAudio, Mic, Piano } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { createBlankScore } from "@/lib/music/edit";
import { beatsPerMeasureOf } from "@/lib/music/meter";
import { loadScoreDefaults } from "@/lib/storage/preferences";
import { saveScore } from "@/lib/storage/scores";

type Mode = "record" | "keys" | "audio";

const ICONS = { record: Mic, keys: Piano, audio: FileAudio } as const;

const PANELS: { id: Mode; tab: string; title: string; sub: string; cta: string; href: string }[] = [
  { id: "record", tab: "녹음", title: "떠오른 멜로디를 흥얼거려 보세요", sub: "30초면 코드 악보가 만들어져요", cta: "녹음 시작", href: "/record" },
  { id: "keys", tab: "건반 입력", title: "88건반을 눌러 음표를 적어요", sub: "음 길이를 고르고 건반을 누르면 바로 악보가 그려져요", cta: "건반으로 입력", href: "/keys?entry=1" },
  // href 없음 — 빈 악보를 만든 뒤 편집 화면에서 음원 등록 창을 바로 연다(score-client 의 ?import=audio)
  { id: "audio", tab: "음원 파일", title: "MP3·WAV 파일로 악보를 만들어요", sub: "악기 연주 음원에서 음을 찾아 악보로 바꿔요. 파일은 기기 밖으로 나가지 않아요", cta: "음원 파일 올리기", href: "" },
];

export function StartCard() {
  const [mode, setMode] = useState<Mode>("record");
  const [busy, setBusy] = useState(false);
  const router = useRouter();
  // 이전 화면 상태가 보존되므로(Next 16 Activity) 화면을 떠날 때 버튼을 되돌린다
  useEffect(() => () => setBusy(false), []);

  async function startFromAudio() {
    setBusy(true);
    try {
      const { bpm, meter } = loadScoreDefaults(); // 설정의 새 악보 기본값
      const blank = createBlankScore({ title: `음원 악보 ${new Date().toLocaleString("ko-KR")}`, bpm, beatsPerMeasure: beatsPerMeasureOf(meter) });
      const score = await saveScore({ ...blank, meter });
      router.push(`/scores/${score.id}?import=audio`);
    } catch {
      setBusy(false);
    }
  }

  return (
    <Card className="gap-4 p-4 shadow-md" aria-label="새 악보 만들기">
      <div role="tablist" aria-label="입력 방식" className="flex gap-2">
        {PANELS.map((p) => {
          const on = mode === p.id;
          const Icon = ICONS[p.id];
          return (
            <Button
              key={p.id}
              type="button"
              role="tab"
              id={`start-tab-${p.id}`}
              aria-selected={on}
              aria-controls={`start-panel-${p.id}`}
              variant="outline"
              onClick={() => setMode(p.id)}
              className={`h-11 flex-1 gap-2 text-sm ${on ? "border-accent text-accent" : "text-ink-soft"}`}
            >
              <Icon aria-hidden />
              {p.tab}
            </Button>
          );
        })}
      </div>

      {/* 두 패널을 같은 grid 칸에 겹쳐 항상 큰 쪽 크기로 고정 */}
      <CardContent className="grid p-0">
        {PANELS.map((p) => {
          const on = mode === p.id;
          const Icon = ICONS[p.id];
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={`start-panel-${p.id}`}
              aria-labelledby={`start-tab-${p.id}`}
              aria-hidden={!on}
              className={`flex min-w-0 flex-col gap-4 [grid-area:1/1] ${on ? "" : "pointer-events-none invisible"}`}
            >
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-5 py-8 text-center">
                <span className="text-accent"><Icon className="size-9" strokeWidth={1.8} aria-hidden /></span>
                <strong className="font-medium">{p.title}</strong>
                <small className="text-xs text-ink-soft">{p.sub}</small>
              </div>
              {p.href ? (
                <Button asChild variant="outline" className="h-11 w-full border-accent text-accent hover:bg-accent/10 hover:text-accent">
                  <Link href={p.href} tabIndex={on ? 0 : -1}>{p.cta}</Link>
                </Button>
              ) : (
                <Button type="button" variant="outline" disabled={busy} tabIndex={on ? 0 : -1} onClick={startFromAudio} className="h-11 w-full border-accent text-accent hover:bg-accent/10 hover:text-accent">
                  {busy ? "준비 중…" : p.cta}
                </Button>
              )}
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
