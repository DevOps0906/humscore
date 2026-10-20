"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { PIANO_KEYS } from "@/lib/music/frequency";

const WHITES = PIANO_KEYS.filter((k) => !k.isBlack);
const W = 100 / WHITES.length;
const MIDDLE_C = 60;
/** 터치로 눌렀다 뗄 때 이 거리(px) 미만 이동이어야 입력으로 인정 */
const TAP_SLOP = 10;

interface Props {
  onPress: (midi: number) => void;
  /** 현재 선택된 건반 */
  active?: number | null;
  /** 강조할 건반들 */
  highlight?: Set<number>;
  /** 외부(PC 키보드 등)에서 눌린 건반 */
  pressed?: Set<number>;
  className?: string;
}

interface TouchState {
  midi: number;
  x: number;
  y: number;
  scrollLeft: number;
  cancelled: boolean;
}

/**
 * 88건반(폭 1800px 이상, 가로 스크롤). 마운트 시 가온 C(C4)를 가운데에 둔다.
 * active가 바뀌면 보이는 영역 밖일 때 부드럽게 스크롤. 터치는 탭일 때만 onPress(스크롤 오입력 방지).
 */
export function PianoKeyboard({ onPress, active = null, highlight, pressed: externalPressed, className = "" }: Props) {
  const [inner, setInner] = useState<Set<number>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);
  const touches = useRef<Map<number, TouchState>>(new Map());
  const positioned = useRef(false);
  const [tabStop, setTabStop] = useState(MIDDLE_C);

  /** 건반 midi 를 가로 가운데로 */
  const centerOn = useCallback((midi: number, smooth: boolean) => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-midi="${midi}"]`);
    if (!box || !el) return;
    box.scrollTo({
      left: el.offsetLeft - box.clientWidth / 2 + el.offsetWidth / 2,
      behavior: smooth ? "smooth" : "instant",
    });
  }, []);

  const isVisible = useCallback((midi: number) => {
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-midi="${midi}"]`);
    if (!box || !el) return true;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    return !(left < box.scrollLeft + 20 || right > box.scrollLeft + box.clientWidth - 20);
  }, []);

  // 마운트: 가온 C 중심(애니메이션 없음). 폭이 아직 0 이면 정해질 때까지 ResizeObserver 로 대기
  const activeAtMount = useRef(active);
  useLayoutEffect(() => {
    const box = scroller.current;
    if (!box) return;
    let ro: ResizeObserver | null = null;
    const place = () => {
      if (positioned.current || box.clientWidth === 0) return false;
      centerOn(MIDDLE_C, false);
      const a = activeAtMount.current;
      if (a !== null && !isVisible(a)) centerOn(a, false);
      positioned.current = true;
      ro?.disconnect();
      return true;
    };
    if (!place() && typeof ResizeObserver !== "undefined") {
      ro = new ResizeObserver(() => {
        place();
      });
      ro.observe(box);
    }
    return () => ro?.disconnect();
  }, [centerOn, isVisible]);

  // active 변경: 화면 밖이면 부드럽게 이동 (초기 배치 전에는 건너뜀)
  useEffect(() => {
    if (active === null || !positioned.current) return;
    if (!isVisible(active)) centerOn(active, true);
  }, [active, centerOn, isVisible]);

  const scrollByOctave = (dir: -1 | 1) => {
    const box = scroller.current;
    if (!box) return;
    const whiteW = box.scrollWidth / WHITES.length;
    box.scrollBy({ left: dir * 7 * whiteW, behavior: "smooth" });
  };

  const markDown = (midi: number) => setInner((p) => new Set([...p, midi]));
  const release = (midi: number) =>
    setInner((p) => {
      if (!p.has(midi)) return p;
      const n = new Set(p);
      n.delete(midi);
      return n;
    });
  const isDown = (m: number) => inner.has(m) || !!externalPressed?.has(m);

  // 마우스는 즉시 입력, 터치·펜은 눌림 표시만 하고 손을 뗄 때 탭(이동 없음)이면 입력
  // (스크롤 제스처는 pointercancel 로 끝나므로 touches 항목이 지워져 입력되지 않는다)
  const handlers = (midi: number) => ({
    onPointerDown: (e: React.PointerEvent) => {
      if (e.pointerType === "mouse" && e.button !== 0) return; // 우클릭·보조 버튼 무시
      markDown(midi);
      if (e.pointerType !== "mouse") {
        touches.current.set(e.pointerId, {
          midi,
          x: e.clientX,
          y: e.clientY,
          scrollLeft: scroller.current?.scrollLeft ?? 0,
          cancelled: false,
        });
      } else {
        onPress(midi);
      }
    },
    onPointerUp: (e: React.PointerEvent) => {
      release(midi);
      const t = touches.current.get(e.pointerId);
      if (!t) return;
      touches.current.delete(e.pointerId);
      const moved = Math.hypot(e.clientX - t.x, e.clientY - t.y);
      const scrolled = Math.abs((scroller.current?.scrollLeft ?? 0) - t.scrollLeft) > 1;
      if (!t.cancelled && moved < TAP_SLOP && !scrolled) onPress(t.midi);
    },
    onPointerLeave: (e: React.PointerEvent) => {
      if (e.pointerType === "touch") return; // 터치는 포인터 캡처로 계속 이 건반이 받음
      if (e.pointerType === "pen") touches.current.delete(e.pointerId); // 펜이 건반을 벗어나면 입력 취소
      release(midi);
    },
    onPointerCancel: (e: React.PointerEvent) => {
      touches.current.delete(e.pointerId);
      release(midi);
    },
    // 키보드(Enter/Space) 활성화: detail 0. 눌림 표시를 잠깐 보여준다
    onClick: (e: React.MouseEvent) => {
      if (e.detail !== 0) return;
      onPress(midi);
      markDown(midi);
      window.setTimeout(() => release(midi), 120);
    },
    // roving tabindex: 포커스된 건반만 Tab 정지점, 좌우 방향키로 이웃 건반 이동
    tabIndex: midi === tabStop ? 0 : -1,
    onFocus: () => setTabStop(midi),
    onKeyDown: (e: React.KeyboardEvent) => {
      const d = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
      if (!d) return;
      const next = scroller.current?.querySelector<HTMLElement>(`[data-midi="${midi + d}"]`);
      if (!next) return;
      e.preventDefault();
      next.focus();
    },
    "aria-pressed": isDown(midi),
  });

  const nav =
    "h-11 rounded-full border border-line bg-surface px-4 text-sm text-ink outline-none hover:bg-section focus-visible:ring-2 focus-visible:ring-ring lg:h-9";

  return (
    <div className={className}>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <button type="button" className={nav} onClick={() => scrollByOctave(-1)}>
          ◀ 옥타브
        </button>
        <button type="button" className={nav} onClick={() => centerOn(MIDDLE_C, true)}>
          가온 C
        </button>
        <button type="button" className={nav} onClick={() => scrollByOctave(1)}>
          옥타브 ▶
        </button>
      </div>
      <div
        ref={scroller}
        className="relative overflow-x-auto pb-2"
        style={{ touchAction: "pan-x pan-y" }}
        data-testid="piano-scroller"
      >
        <div className="relative flex h-40 min-w-[1800px] select-none touch-manipulation">
          {WHITES.map((k) => {
            const down = isDown(k.midi);
            const isActive = active === k.midi;
            const hl = highlight?.has(k.midi);
            const middleC = k.midi === MIDDLE_C;
            return (
              <button
                key={k.midi}
                type="button"
                data-midi={k.midi}
                {...handlers(k.midi)}
                className={[
                  "relative flex-1 rounded-b border border-section outline-none transition-all duration-75 focus-visible:z-20 focus-visible:ring-2 focus-visible:ring-ring",
                  down
                    ? "translate-y-0.5 bg-accent shadow-[inset_0_3px_6px_rgba(0,0,0,0.25)]"
                    : isActive || hl
                      ? "bg-accent/60"
                      : "bg-[#f3f5fe] hover:bg-[#e4e7f5]",
                ].join(" ")}
                aria-label={`${middleC ? "가온 도 " : ""}${k.name} ${k.freq.toFixed(2)}Hz`}
                title={middleC ? "가온 도 C4" : undefined}
              >
                {middleC && (
                  <span
                    aria-hidden
                    className="absolute inset-x-0 bottom-6 mx-auto block h-2.5 w-2.5 rounded-full bg-accent ring-2 ring-white"
                  />
                )}
                {k.name.startsWith("C") && (
                  <span
                    className={`absolute inset-x-0 bottom-1 text-[10px] ${middleC ? "font-bold text-ink" : "text-[#595d6c]"}`}
                  >
                    {k.name}
                  </span>
                )}
              </button>
            );
          })}
          {PIANO_KEYS.filter((k) => k.isBlack).map((k) => {
            const i = WHITES.findIndex((x) => x.midi === k.midi - 1);
            const down = isDown(k.midi);
            return (
              <button
                key={k.midi}
                type="button"
                data-midi={k.midi}
                {...handlers(k.midi)}
                className={[
                  "absolute top-0 z-10 h-24 rounded-b outline-none transition-all duration-75 focus-visible:ring-2 focus-visible:ring-ring",
                  down
                    ? "translate-y-1 bg-accent"
                    : active === k.midi || highlight?.has(k.midi)
                      ? "bg-accent"
                      : "bg-[#161826] hover:bg-[#2a2d3d] ring-1 ring-section-ghost",
                ].join(" ")}
                style={{ left: `${(i + 1) * W - W * 0.32}%`, width: `${W * 0.64}%` }}
                aria-label={`${k.name} ${k.freq.toFixed(2)}Hz`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
