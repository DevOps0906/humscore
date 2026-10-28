"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";
import { getAudioContext } from "@/lib/audio/context";
import { playPianoNote } from "@/lib/audio/piano-synth";
import { SAMPLE_CHORDS, SAMPLE_NOTES } from "./data";
import styles from "./landing.module.css";

const STEP_SEC = 0.45;
const NOTE_X = [24, 54, 84, 128, 158, 188, 234, 264, 294];
const STAFF_LINES = [20, 30, 40, 50, 60];
const BARS = [106, 213, 319];
const PITCH_GRID = [20, 50, 80, 110];
/** 흥얼거린 음정 곡선(시안 v2): 음마다 살짝 흔들리며 계단식으로 오르내린다 */
const PITCH_CURVE = "10,84 40,84 52,70 80,70 92,58 120,57 132,46 160,46 172,58 200,58 212,70 240,70 252,84 280,84 292,46 320,46 332,34 352,34";

/** 허밍 <-> 악보 비교 데모. 음성 파일 없이 합성 피아노음으로 샘플 멜로디를 재생하며 음표를 순서대로 강조한다. */
export function CompareDemo() {
  const [playing, setPlaying] = useState(false);
  const [active, setActive] = useState(-1);
  const timers = useRef<number[]>([]);
  const bus = useRef<GainNode | null>(null);
  const unlisten = useRef<(() => void) | null>(null);

  const stop = useCallback(() => {
    timers.current.forEach((t) => window.clearTimeout(t));
    timers.current = [];
    unlisten.current?.();
    unlisten.current = null;
    if (bus.current) {
      bus.current.gain.value = 0;
      bus.current.disconnect();
      bus.current = null;
    }
    setPlaying(false);
    setActive(-1);
  }, []);

  useEffect(() => stop, [stop]);

  const play = () => {
    // 제스처 핸들러 안에서 동기 호출. resume은 await하지 않는다.
    const ctx = getAudioContext();
    const out = ctx.createGain();
    out.connect(ctx.destination);
    bus.current = out;
    setPlaying(true);

    const run = () => {
      const t0 = ctx.currentTime + 0.05;
      SAMPLE_NOTES.forEach((n, i) => {
        playPianoNote(ctx, n.midi, t0 + i * STEP_SEC, { duration: STEP_SEC * 0.9, destination: out });
        timers.current.push(window.setTimeout(() => setActive(i), 50 + i * STEP_SEC * 1000));
      });
      timers.current.push(window.setTimeout(stop, 50 + SAMPLE_NOTES.length * STEP_SEC * 1000 + 600));
    };

    if (ctx.state === "running") {
      run();
    } else {
      const h = () => {
        if (ctx.state === "running") {
          ctx.removeEventListener("statechange", h);
          unlisten.current = null;
          run();
        }
      };
      ctx.addEventListener("statechange", h);
      unlisten.current = () => ctx.removeEventListener("statechange", h);
    }
  };

  return (
    <div id="demo" data-reveal className="mt-14 scroll-mt-[72px] rounded-2xl bg-surface p-5 shadow-[var(--shadow-sm)]">
      <h3 className="mb-1 text-xl font-semibold">내가 부른 멜로디, 이렇게 바뀌어요</h3>
      <p className="text-sm text-ink-soft">샘플 멜로디를 들으며, 같은 멜로디가 악보에서 어디인지 따라가 보세요.</p>
      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div className="flex flex-col">
          <p className="mb-2 font-mono text-xs text-ink-soft">흥얼거린 음정 곡선</p>
          <div className="flex min-h-[180px] flex-1 flex-col justify-between gap-4 rounded-lg bg-gradient-to-br from-section to-paper p-5">
            <div className="flex items-center gap-3.5">
              <button
                type="button"
                aria-pressed={playing}
                aria-label="샘플 멜로디 재생"
                onClick={playing ? stop : play}
                className="grid size-[var(--tap-min)] flex-none place-items-center rounded-full bg-accent text-accent-ink hover:bg-lavender-300"
              >
                {playing ? <Pause className="size-5" aria-hidden /> : <Play className="size-5" aria-hidden />}
              </button>
              <svg className={`${styles.pitch} min-w-0 flex-1`} viewBox="0 0 360 120" role="img" aria-label="허밍 음정이 계단식으로 오르내리는 곡선">
                {PITCH_GRID.map((y) => (
                  <line key={y} x1="0" y1={y} x2="360" y2={y} />
                ))}
                <polyline points={PITCH_CURVE} />
              </svg>
            </div>
            <p className="text-xs text-lavender-100">녹음 파일이 아니라 합성 피아노음으로 들려드려요. 소리가 안 나면 오른쪽 악보를 확인하세요.</p>
          </div>
        </div>
        <div>
          <p className="mb-2 font-mono text-xs text-ink-soft">같은 멜로디의 악보</p>
          <div className="rounded-lg bg-score-paper px-[18px] pb-3 pt-4 text-paper" role="img" aria-label="샘플 허밍의 실제 악보">
            <div className="flex justify-between gap-2 text-sm">
              <b>샘플 멜로디</b>
              <span className="font-mono text-xs text-line">C장조 · 4/4</span>
            </div>
            <svg viewBox="0 0 320 80" className="mt-2 block h-auto w-full" aria-hidden>
              <g stroke="currentColor" strokeWidth="1">
                {STAFF_LINES.map((y) => (
                  <line key={y} x1="0" x2="320" y1={y} y2={y} />
                ))}
                {BARS.map((x) => (
                  <line key={x} x1={x} x2={x} y1="20" y2="60" />
                ))}
              </g>
              {SAMPLE_NOTES.map((n, i) => {
                const x = NOTE_X[i];
                const on = i === active;
                return (
                  <g key={i} style={{ color: on ? "var(--accent)" : undefined }}>
                    {on && <circle cx={x} cy={n.y} r="11" fill="currentColor" opacity="0.2" />}
                    <ellipse cx={x} cy={n.y} rx="5.5" ry="4" fill="currentColor" />
                    <line x1={x + 5} x2={x + 5} y1={n.y} y2={n.y - 28} stroke="currentColor" strokeWidth="1.4" />
                  </g>
                );
              })}
            </svg>
            <div className="flex justify-around font-mono text-xs text-section">
              {SAMPLE_CHORDS.map((c) => (
                <span key={c}>{c}</span>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
