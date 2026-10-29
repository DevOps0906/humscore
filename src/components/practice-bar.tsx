"use client";

import { useState } from "react";
import { ChevronDown, Minus, Pause, Play, Plus, Repeat, SkipBack } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ScorePlayback } from "@/hooks/use-score-playback";
import { PLAYBACK_RATES } from "@/lib/music/playback-plan";

/**
 * 연습 바 — 재생·일시정지, 처음으로, 속도(50~100%), 구간 A–B, 반복.
 * 모바일 ~767 은 구간을 접어 두고, 768~ 은 펼친다. 공연 모드·상세 화면 공용.
 */
export function PracticeBar({
  playback: p,
  bpm,
  disabled = false,
}: {
  playback: ScorePlayback;
  /** 악보 원래 빠르기(♩=) */
  bpm: number;
  /** 따라 치기 중 */
  disabled?: boolean;
}) {
  const [rangeOpen, setRangeOpen] = useState(false);
  const off = disabled || !p.playable;
  const active = p.status === "playing" || p.status === "preparing";
  const rateIdx = PLAYBACK_RATES.findIndex((r) => r === p.rate);
  const pct = Math.round(p.rate * 100);
  const measures = Array.from({ length: p.measureCount }, (_, i) => i + 1);
  const { startMeasure: a, endMeasure: b } = p.range;

  const message = !p.playable
    ? "음표가 없어 재생할 수 없어요"
    : disabled
      ? "따라 치기 중에는 재생할 수 없어요"
      : p.status === "preparing"
        ? "소리 준비 중…"
        : p.status === "error"
          ? "소리를 켜지 못했어요. 다시 눌러 주세요"
          : "";
  const looping = !off && p.loop && p.status === "playing";

  const select =
    "h-11 rounded-lg border border-line bg-paper px-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/60 disabled:opacity-50";

  return (
    <div
      role="group"
      aria-label="연습 재생"
      aria-disabled={off || undefined}
      className={`flex flex-col gap-2 rounded-2xl border border-line bg-surface px-3 py-2 shadow-md ${off ? "opacity-60" : ""}`}
    >
      <div className="flex items-center gap-2">
        <Button
          type="button"
          onClick={() => p.toggle()}
          disabled={off}
          className="h-11 rounded-full px-4 text-sm max-md:size-11 max-md:px-0 md:min-w-28"
          aria-label={active ? "일시정지" : "재생"}
        >
          {active ? <Pause aria-hidden /> : <Play aria-hidden />}
          <span className="max-md:hidden">{active ? "일시정지" : "재생"}</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => p.rewind()} disabled={off} className="size-11 rounded-full bg-paper" aria-label="처음으로">
          <SkipBack aria-hidden />
        </Button>
        <div className="flex flex-1 items-center justify-end gap-1">
          <Button
            type="button"
            variant="outline"
            onClick={() => p.setRate(PLAYBACK_RATES[Math.max(0, rateIdx - 1)])}
            disabled={off || rateIdx <= 0}
            className="size-11 rounded-full bg-paper"
            aria-label="느리게"
          >
            <Minus aria-hidden />
          </Button>
          <output aria-live="polite" className="min-w-18 text-center text-sm leading-tight">
            <span className="block font-semibold">속도 {pct}%</span>
            <span className="block text-xs text-ink-soft">♩={Math.round(bpm * p.rate)}</span>
          </output>
          <Button
            type="button"
            variant="outline"
            onClick={() => p.setRate(PLAYBACK_RATES[Math.min(PLAYBACK_RATES.length - 1, rateIdx + 1)])}
            disabled={off || rateIdx >= PLAYBACK_RATES.length - 1}
            className="size-11 rounded-full bg-paper"
            aria-label="빠르게"
          >
            <Plus aria-hidden />
          </Button>
        </div>
        <Button
          type="button"
          variant="outline"
          onClick={() => setRangeOpen((o) => !o)}
          disabled={off}
          className="size-11 rounded-full bg-paper md:hidden"
          aria-label="구간 반복 설정"
          aria-expanded={rangeOpen}
          aria-controls="practice-range"
        >
          <ChevronDown aria-hidden className={rangeOpen ? "rotate-180" : ""} />
        </Button>
      </div>

      <div id="practice-range" className={`flex-wrap items-center gap-2 text-sm ${rangeOpen ? "flex" : "flex max-md:hidden"}`}>
        <span className="text-ink-soft">구간</span>
        <select className={select} aria-label="구간 시작 마디" value={a} disabled={off} onChange={(e) => p.setRange({ startMeasure: Number(e.target.value), endMeasure: Math.max(b, Number(e.target.value)) })}>
          {measures.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span aria-hidden>–</span>
        <select className={select} aria-label="구간 끝 마디" value={b} disabled={off} onChange={(e) => p.setRange({ startMeasure: Math.min(a, Number(e.target.value)), endMeasure: Number(e.target.value) })}>
          {measures.map((m) => <option key={m} value={m}>{m}</option>)}
        </select>
        <span>마디</span>
        <Button
          type="button"
          variant={p.loop ? "default" : "outline"}
          onClick={() => p.setLoop(!p.loop)}
          disabled={off}
          aria-pressed={p.loop}
          className={`ml-auto h-11 rounded-full px-4 text-sm ${p.loop ? "" : "bg-paper"}`}
        >
          <Repeat aria-hidden />
          <span>반복 {p.loop ? "켜짐" : "꺼짐"}</span>
        </Button>
      </div>

      <p role="status" aria-live="polite" className="flex min-h-6 items-center gap-2 text-sm empty:hidden">
        {looping ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-accent px-2 py-0.5 font-medium text-ink">
            <Repeat aria-hidden className="size-4" />
            반복 {a}–{b} 마디
          </span>
        ) : message ? (
          <span className={p.status === "error" ? "text-destructive" : "text-ink-soft"}>{message}</span>
        ) : null}
      </p>
    </div>
  );
}
