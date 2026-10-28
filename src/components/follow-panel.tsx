"use client";

import { useState } from "react";
import { Check, CircleAlert, Mic, Pause, Piano, Play, RotateCcw, Square, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { solfegeName } from "@/lib/audio/live-notes";
import { midiToName } from "@/lib/music/frequency";
import type { useFollowAlong } from "@/hooks/use-follow-along";

type Follow = ReturnType<typeof useFollowAlong>;

const NOOP = () => {};

/** 걸린 시간 "m분 s초" */
export function formatElapsed(ms: number): string {
  const sec = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(sec / 60);
  return m > 0 ? `${m}분 ${sec % 60}초` : `${sec}초`;
}

function feedbackText(f: NonNullable<Follow["feedback"]>): { icon: "ok" | "warn" | "bad"; text: string } {
  if (f.kind === "correct") return { icon: "ok", text: `맞아요 — ${solfegeName(f.heard)}` };
  if (f.kind === "octave")
    return { icon: "warn", text: `옥타브를 확인해 보세요 — 친 음: ${midiToName(f.heard)}, 칠 음: ${midiToName(f.target)}` };
  return { icon: "bad", text: `다른 음이에요 — 친 음: ${solfegeName(f.heard)}` };
}

/** 공연 모드 하단 "따라 치기" 패널: 시작·일시정지·처음부터·끝내기, 판정 표시, 끝 화면, 힌트 건반 */
export function FollowPanel({ follow }: { follow: Follow }) {
  const { phase, inputKind, total, index, currentTarget, feedback, error } = follow;
  const [hint, setHint] = useState(true);
  const btn = "h-11 rounded-full px-4 text-sm md:text-base min-[1200px]:text-lg";
  const midiProblem =
    inputKind === "midi" && (follow.midiStatus === "denied" || follow.midiStatus === "unsupported")
      ? follow.midiMessage || "MIDI 건반을 사용할 수 없어요."
      : "";
  const notice = midiProblem || error;

  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-2 pb-2" data-testid="follow-panel">
      {total === 0 && <p className="text-sm text-ink-soft md:text-base">칠 음표가 없어요. 악보에 음표를 먼저 입력해 주세요.</p>}

      {notice && (
        <p role="alert" className="flex items-start gap-2 text-sm text-tune-bad md:text-base">
          <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> {notice}
        </p>
      )}

      {phase === "idle" && total > 0 && (
        <>
          {follow.hasChord && (
            <p className="flex items-start gap-2 text-sm text-ink-soft md:text-base">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden /> 화음이 있는 악보예요. 맨 위 음(멜로디)만 판정해요.
            </p>
          )}
          <p className="text-sm text-ink-soft md:text-base">
            마이크는 기기를 피아노 가까이 두고 주변 소음을 줄여 주세요. 소리는 저장하거나 보내지 않아요.
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className={btn} onClick={() => void follow.start("mic")}>
              <Mic aria-hidden /> 마이크로 시작
            </Button>
            <Button type="button" variant="outline" className={btn} onClick={() => void follow.start("midi")}>
              <Piano aria-hidden /> MIDI 건반으로 시작
            </Button>
          </div>
        </>
      )}

      {(phase === "running" || phase === "paused") && (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {phase === "running" ? (
              <Button type="button" variant="outline" className={btn} onClick={follow.pause}>
                <Pause aria-hidden /> 일시정지
              </Button>
            ) : (
              <Button type="button" className={btn} onClick={() => void follow.resume()}>
                <Play aria-hidden /> 이어서
              </Button>
            )}
            <Button type="button" variant="outline" className={btn} onClick={() => void follow.restart()}>
              <RotateCcw aria-hidden /> 처음부터
            </Button>
            <Button type="button" variant="outline" className={btn} onClick={follow.end}>
              <Square aria-hidden /> 끝내기
            </Button>
            <p className="ml-auto text-sm tabular-nums text-ink-soft md:text-base">
              {index + 1} / {total}
            </p>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-line" aria-hidden>
            <div className="h-full bg-accent" style={{ width: `${total ? (index / total) * 100 : 0}%` }} />
          </div>
          <p role="status" aria-live="polite" className="min-h-6 text-sm font-medium md:text-base min-[1200px]:text-lg">
            {phase === "paused" ? (
              "일시정지 중이에요."
            ) : feedback ? (
              (() => {
                const t = feedbackText(feedback);
                return (
                  <span
                    className={`inline-flex items-center gap-1.5 ${
                      t.icon === "ok" ? "text-tune-good" : t.icon === "warn" ? "text-tune-warn" : "text-tune-bad"
                    }`}
                  >
                    {t.icon === "ok" ? <Check className="size-4" aria-hidden /> : <TriangleAlert className="size-4" aria-hidden />}
                    {t.text}
                  </span>
                );
              })()
            ) : (
              <span className="text-ink-soft">표시된 음을 쳐 보세요.</span>
            )}
          </p>
          <Button
            type="button"
            variant="outline"
            className="h-11 w-fit rounded-full px-4 text-sm md:text-base min-[1200px]:text-lg [@media(max-height:480px)]:hidden"
            aria-pressed={hint}
            onClick={() => setHint(!hint)}
          >
            <Piano aria-hidden /> 건반 힌트 {hint ? "끄기" : "켜기"}
          </Button>
          <div className={`overflow-hidden rounded-lg border border-line [@media(max-height:480px)]:hidden ${hint ? "" : "hidden"}`}>
            <PianoKeyboard
              compact
              onPress={NOOP}
              active={currentTarget}
              highlight={currentTarget !== null ? new Set([currentTarget]) : undefined}
            />
          </div>
        </>
      )}

      {phase === "done" && (
        <div className="flex flex-col gap-2" role="status" aria-live="polite">
          <p className="flex items-center gap-2 text-lg font-semibold text-tune-good md:text-xl">
            <Check className="size-5" aria-hidden /> 끝까지 쳤어요
          </p>
          <p className="text-sm text-ink-soft md:text-base">
            틀린 횟수 {follow.wrongCount}번 · 걸린 시간 {formatElapsed(follow.elapsedMs)}
          </p>
          <div className="flex flex-wrap gap-2">
            <Button type="button" className={btn} onClick={() => void follow.restart()}>
              <RotateCcw aria-hidden /> 다시 하기
            </Button>
            <Button type="button" variant="outline" className={btn} onClick={follow.end}>
              끝내기
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
