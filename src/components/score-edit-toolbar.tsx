"use client";

import { ArrowDown, ArrowUp, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { STEP_DURATIONS } from "@/lib/music/edit";

const BASES = [
  { v: 0.25, label: "16분" },
  { v: 0.5, label: "8분" },
  { v: 1, label: "4분" },
  { v: 2, label: "2분" },
  { v: 4, label: "온" },
];
const DOTTED = [0.75, 1.5, 3];

const btn =
  "h-9 min-w-9 rounded-full bg-surface px-2.5 text-xs [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11 [@media(pointer:coarse)]:text-sm";
const on = "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent";

/** 악보 위에 뜨는 음표 편집 도구 (▼ 커서 옆). 동작은 키보드 편집과 같은 함수를 호출 */
export function ScoreEditToolbar({
  noteLabel,
  interval,
  isRest,
  duration,
  onPitch,
  onDuration,
  onDot,
  onDuplicate,
  onDelete,
  onClose,
}: {
  /** 예: "E4" / "쉼표" */
  noteLabel: string;
  interval: string | null;
  isRest: boolean;
  duration: number;
  /** 키(`ArrowUp` 등)와 동일한 의미: +1/-1 반음 */
  onPitch: (delta: 1 | -1) => void;
  /** base 음가 키 "1".."5" */
  onDuration: (digit: "1" | "2" | "3" | "4" | "5") => void;
  onDot: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const dotted = DOTTED.includes(duration);
  const base = dotted ? duration / 1.5 : duration;
  const canDot = dotted || STEP_DURATIONS.includes(duration * 1.5);
  return (
    <div role="toolbar" aria-label="음표 편집" data-testid="score-toolbar" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-[11px] text-ink-soft">
        <span>
          <strong className="text-ink">{noteLabel}</strong>
          {interval && <span className="ml-1.5">{interval}</span>}
        </span>
        <Button type="button" variant="ghost" onClick={onClose} aria-label="편집 도구 닫기" className="-my-1 -mr-1 size-8 rounded-full p-0 text-ink-soft [@media(pointer:coarse)]:size-11">
          <X aria-hidden />
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" className={btn} disabled={isRest} onClick={() => onPitch(1)} aria-label="반음 올림">
          <ArrowUp aria-hidden /> 반음
        </Button>
        <Button type="button" variant="outline" className={btn} disabled={isRest} onClick={() => onPitch(-1)} aria-label="반음 내림">
          <ArrowDown aria-hidden /> 반음
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        {BASES.map((d, i) => (
          <Button
            key={d.v}
            type="button"
            variant="outline"
            className={`${btn} ${base === d.v ? on : ""}`}
            aria-pressed={base === d.v}
            onClick={() => onDuration(String(i + 1) as "1")}
          >
            {d.label}
          </Button>
        ))}
        <Button type="button" variant="outline" className={`${btn} ${dotted ? on : ""}`} aria-pressed={dotted} disabled={!canDot} onClick={onDot} aria-label="점음표">
          점
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <Button type="button" variant="outline" className={btn} onClick={onDuplicate}>
          <Copy aria-hidden /> 복제
        </Button>
        <Button type="button" variant="destructive" className="h-9 min-w-9 rounded-full px-2.5 text-xs [@media(pointer:coarse)]:h-11 [@media(pointer:coarse)]:min-w-11 [@media(pointer:coarse)]:text-sm" onClick={onDelete}>
          <Trash2 aria-hidden /> 삭제
        </Button>
      </div>
    </div>
  );
}
