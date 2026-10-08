"use client";

import { useEffect, useRef, useState } from "react";
import { PIANO_KEYS } from "@/lib/music/frequency";

const WHITES = PIANO_KEYS.filter((k) => !k.isBlack);
const W = 100 / WHITES.length;

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

/** 88건반. active가 바뀌면 보이는 영역 밖일 때 가로 스크롤로 가운데로 옮김 */
export function PianoKeyboard({ onPress, active = null, highlight, pressed: externalPressed, className = "" }: Props) {
  const [inner, setInner] = useState<Set<number>>(new Set());
  const scroller = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (active === null) return;
    const box = scroller.current;
    const el = box?.querySelector<HTMLElement>(`[data-midi="${active}"]`);
    if (!box || !el) return;
    const left = el.offsetLeft;
    const right = left + el.offsetWidth;
    if (left < box.scrollLeft + 20 || right > box.scrollLeft + box.clientWidth - 20) {
      box.scrollTo({ left: left - box.clientWidth / 2 + el.offsetWidth / 2, behavior: "smooth" });
    }
  }, [active]);

  const press = (midi: number) => {
    setInner((p) => new Set([...p, midi]));
    onPress(midi);
  };
  const release = (midi: number) =>
    setInner((p) => {
      if (!p.has(midi)) return p;
      const n = new Set(p);
      n.delete(midi);
      return n;
    });
  const isDown = (m: number) => inner.has(m) || !!externalPressed?.has(m);

  return (
    <div ref={scroller} className={`relative overflow-x-auto pb-2 ${className}`}>
      <div className="relative flex h-40 min-w-[900px] select-none touch-manipulation">
        {WHITES.map((k) => {
          const down = isDown(k.midi);
          const isActive = active === k.midi;
          const hl = highlight?.has(k.midi);
          return (
            <button
              key={k.midi}
              type="button"
              data-midi={k.midi}
              onPointerDown={() => press(k.midi)}
              onPointerUp={() => release(k.midi)}
              onPointerLeave={() => release(k.midi)}
              onPointerCancel={() => release(k.midi)}
              className={[
                "relative flex-1 rounded-b border border-line transition-all duration-75",
                down
                  ? "translate-y-0.5 bg-accent/30 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15)]"
                  : isActive || hl
                    ? "bg-accent/25"
                    : "bg-white hover:bg-neutral-50",
              ].join(" ")}
              aria-label={`${k.name} ${k.freq.toFixed(2)}Hz`}
            >
              {k.name.startsWith("C") && (
                <span className="absolute inset-x-0 bottom-1 text-[10px] text-neutral-400">{k.name}</span>
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
              onPointerDown={() => press(k.midi)}
              onPointerUp={() => release(k.midi)}
              onPointerLeave={() => release(k.midi)}
              onPointerCancel={() => release(k.midi)}
              className={[
                "absolute top-0 z-10 h-24 rounded-b transition-all duration-75",
                down
                  ? "translate-y-1 bg-neutral-600"
                  : active === k.midi || highlight?.has(k.midi)
                    ? "bg-accent"
                    : "bg-neutral-900 hover:bg-neutral-700",
              ].join(" ")}
              style={{ left: `${(i + 1) * W - W * 0.32}%`, width: `${W * 0.64}%` }}
              aria-label={`${k.name} ${k.freq.toFixed(2)}Hz`}
            />
          );
        })}
      </div>
    </div>
  );
}
