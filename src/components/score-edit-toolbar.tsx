"use client";

import { ArrowDown, ArrowUp, ChevronDown, Copy, Trash2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { STEP_DURATIONS } from "@/lib/music/edit";
import type { DynamicEvent, MeasureMarkKind } from "@/lib/music/types";

type DynamicKind = DynamicEvent["kind"];

const DYNAMIC_CHIPS: { kind: DynamicKind; label: string; aria: string }[] = [
  { kind: "pp", label: "pp", aria: "pp 매우 여리게" },
  { kind: "p", label: "p", aria: "p 여리게" },
  { kind: "mp", label: "mp", aria: "mp 조금 여리게" },
  { kind: "mf", label: "mf", aria: "mf 조금 세게" },
  { kind: "f", label: "f", aria: "f 세게" },
  { kind: "ff", label: "ff", aria: "ff 매우 세게" },
  { kind: "cresc", label: "cresc.", aria: "크레셴도 점점 세게" },
  { kind: "dim", label: "dim.", aria: "디미누엔도 점점 여리게" },
];

/** 마디 기호 메뉴 (그룹별). 라벨은 한국어 + 기호 */
export const MARK_GROUPS: { title: string; items: { kind: MeasureMarkKind; label: string }[] }[] = [
  {
    title: "도돌이표",
    items: [
      { kind: "repeatStart", label: "도돌이 시작 ‖:" },
      { kind: "repeatEnd", label: "도돌이 끝 :‖" },
    ],
  },
  {
    title: "표지",
    items: [
      { kind: "segno", label: "Segno (세뇨 표지)" },
      { kind: "coda", label: "Coda (코다 표지)" },
      { kind: "fine", label: "Fine (끝)" },
      { kind: "toCoda", label: "To Coda (코다로 건너뛰기)" },
    ],
  },
  {
    title: "되돌아가기",
    items: [
      { kind: "dc", label: "D.C. (처음으로)" },
      { kind: "dcAlFine", label: "D.C. al Fine (처음으로 가서 Fine까지)" },
      { kind: "dcAlCoda", label: "D.C. al Coda (처음으로 가서 코다로)" },
      { kind: "ds", label: "D.S. (세뇨로 가서 끝까지)" },
      { kind: "dsAlFine", label: "D.S. al Fine (세뇨로 가서 Fine까지)" },
      { kind: "dsAlCoda", label: "D.S. al Coda (세뇨로 가서 코다로)" },
    ],
  },
];

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
  dynamic,
  onDynamic,
  measureNumber,
  activeMarks,
  onToggleMark,
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
  /** 이 음표 위치에 지정된 셈여림(없으면 null) */
  dynamic: DynamicKind | null;
  /** 같은 종류를 다시 누르거나 null 이면 제거 */
  onDynamic: (kind: DynamicKind | null) => void;
  /** 이 음표가 속한 마디 번호(1부터) */
  measureNumber: number;
  activeMarks: MeasureMarkKind[];
  onToggleMark: (kind: MeasureMarkKind) => void;
}) {
  const dotted = DOTTED.includes(duration);
  const base = dotted ? duration / 1.5 : duration;
  const canDot = dotted || STEP_DURATIONS.includes(duration * 1.5);
  return (
    <div role="toolbar" aria-label="음표 편집" data-testid="score-toolbar" className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2 text-xs text-ink-soft">
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
      <div role="group" aria-label="셈여림" className="flex flex-wrap items-center gap-1">
        {DYNAMIC_CHIPS.map((d) => (
          <Button
            key={d.kind}
            type="button"
            variant="outline"
            aria-label={d.aria}
            aria-pressed={dynamic === d.kind}
            className={`${btn} italic ${dynamic === d.kind ? on : ""}`}
            onClick={() => onDynamic(dynamic === d.kind ? null : d.kind)}
          >
            {d.label}
          </Button>
        ))}
        <Button type="button" variant="outline" className={btn} disabled={dynamic === null} onClick={() => onDynamic(null)} aria-label="셈여림 제거">
          제거
        </Button>
      </div>
      <div className="flex flex-wrap items-center gap-1">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button type="button" variant="outline" className={`${btn} ${activeMarks.length ? on : ""}`} aria-label={`${measureNumber}마디 기호`}>
              {measureNumber}마디 기호{activeMarks.length ? ` (${activeMarks.length})` : ""} <ChevronDown aria-hidden />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-72 max-w-[calc(100vw-1rem)]" aria-label="마디 기호">
            {MARK_GROUPS.map((g, gi) => (
              <div key={g.title} role="group" aria-label={g.title}>
                {gi > 0 && <DropdownMenuSeparator />}
                <DropdownMenuLabel>{g.title}</DropdownMenuLabel>
                {g.items.map((it) => (
                  <DropdownMenuCheckboxItem
                    key={it.kind}
                    checked={activeMarks.includes(it.kind)}
                    onCheckedChange={() => onToggleMark(it.kind)}
                    className="min-h-9 [@media(pointer:coarse)]:min-h-11 [@media(pointer:coarse)]:text-base"
                  >
                    {it.label}
                  </DropdownMenuCheckboxItem>
                ))}
              </div>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
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
