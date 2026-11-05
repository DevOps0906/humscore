"use client";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Play, Square } from "lucide-react";
import { ScoreHeader } from "@/components/score-header";
import { scoreTypography } from "@/lib/music/header-fonts";
import { ScoreView } from "@/components/score-view";
import { Button } from "@/components/ui/button";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import { playScore, type Playback } from "@/lib/audio/piano-synth";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import type { Score } from "@/lib/music/types";

/** S01 읽기 전용 보기·재생 — 편집 UI 없음. 소유자 정보·출처 URL 은 데이터에 없다. */
export function SharedClient({ score }: { score: Score }) {
  const xml = useMemo(() => scoreToMusicXML(score, "lead", { externalHeader: true }), [score]);
  const [playing, setPlaying] = useState(false);
  const playback = useRef<Playback | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const cleanup = useRef<(() => void) | null>(null);
  const playable = score.notes.some((n) => n.midi !== null);

  function stop() {
    cleanup.current?.();
    cleanup.current = null;
    playback.current?.stop();
    playback.current = null;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  }
  useEffect(() => stop, []);

  function toggle() {
    if (playing) {
      stop();
      setPlaying(false);
      return;
    }
    stop();
    setAudioSessionType("playback");
    const ctx = getAudioContext(); // 제스처 핸들러 안에서 동기 호출 (await 금지)
    const doPlay = () => {
      playback.current = playScore(ctx, score, {});
      timer.current = setTimeout(() => setPlaying(false), (playback.current.durationSec + 2.5) * 1000);
    };
    setPlaying(true);
    if (ctx.state === "running") {
      doPlay();
      return;
    }
    let giveUp: ReturnType<typeof setTimeout> | null = null;
    const release = () => {
      ctx.removeEventListener("statechange", h);
      if (giveUp) clearTimeout(giveUp);
      cleanup.current = null;
    };
    function h() {
      if (ctx.state === "running") {
        release();
        doPlay();
      }
    }
    ctx.addEventListener("statechange", h);
    giveUp = setTimeout(() => {
      release();
      setPlaying(false);
    }, 3000);
    cleanup.current = release;
  }

  return (
    <main className="safe-top mx-auto flex w-full max-w-5xl flex-1 flex-col gap-4 px-4 pb-28 pt-4 md:px-8 md:pt-6 lg:px-10 lg:pt-8">
      <ScoreView typography={scoreTypography(score)} xml={xml} showHeader={false} header={<ScoreHeader score={score} />} />
      <p className="text-center text-xs text-ink-soft">
        읽기 전용 공유 악보예요.{" "}
        <Link href="/" rel="noreferrer" className="text-accent underline underline-offset-4">
          HumScore로 만들어 보기
        </Link>
      </p>
      <div className="fixed inset-x-0 bottom-0 z-10 px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-md items-center justify-center">
          <Button
            type="button"
            onClick={toggle}
            disabled={!playable}
            className={`size-14 shrink-0 rounded-full text-accent-ink shadow-md [&_svg:not([class*=size-])]:size-6 ${playing ? "bg-tune-bad hover:bg-tune-bad/80" : ""}`}
            aria-label={playing ? "정지" : "재생"}
          >
            {playing ? <Square fill="currentColor" aria-hidden /> : <Play fill="currentColor" aria-hidden />}
          </Button>
        </div>
      </div>
    </main>
  );
}
