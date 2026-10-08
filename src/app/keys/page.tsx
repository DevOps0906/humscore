"use client";

import { useEffect, useRef, useState } from "react";
import { getAudioContext } from "@/lib/audio/context";
import { playPianoNote } from "@/lib/audio/piano-synth";
import { PIANO_KEYS } from "@/lib/music/frequency";

// ── 오선지 컴포넌트 ──────────────────────────────────────────────────────
// pc(0~11) → 온음계 단계 C=0,D=1,E=2,F=3,G=4,A=5,B=6 (샤프은 아랫 음으로)
const DIATONIC  = [0, 0, 1, 1, 2, 3, 3, 4, 4, 5, 5, 6];
const IS_SHARP  = [false,true,false,true,false,false,true,false,true,false,true,false];

function calcStaff(midi: number): { step: number; sharp: boolean; clef: "treble" | "bass" } {
  const pc      = ((midi % 12) + 12) % 12;
  const octave  = Math.floor(midi / 12) - 1;
  const diaton  = DIATONIC[pc];
  const sharp   = IS_SHARP[pc];
  // 트레블: 기준 E4(MIDI 64) = step 0  / 배스: 기준 G2(MIDI 43) = step 0
  const clef = midi >= 48 ? "treble" : "bass";
  const step = clef === "treble"
    ? (octave - 4) * 7 + (diaton - 2)   // E4 기준
    : (octave - 2) * 7 + (diaton - 4);  // G2 기준
  return { step, sharp, clef };
}

function NoteStaff({ midi }: { midi: number }) {
  const HALF  = 11;       // px — 한 단계(한 칸의 절반)
  const GAP   = HALF * 2; // 오선지 인접 선 간격
  const BOT_Y = 130;      // 최하단 선의 y 좌표
  const NX    = 145;      // 음표 x 좌표

  const { step, sharp, clef } = calcStaff(midi);
  const noteY   = BOT_Y - step * HALF;
  const stemUp  = step < 4;

  // 보조선: 오선 바깥(step < 0 또는 step > 8)의 짝수 단계마다
  const ledgers: number[] = [];
  for (let s = -2; s >= step; s -= 2) ledgers.push(BOT_Y - s * HALF);
  for (let s = 10; s <= step; s += 2) ledgers.push(BOT_Y - s * HALF);

  // SVG 높이를 음표 위치에 맞게 자동 조정
  const svgH = Math.max(200, noteY + 60, BOT_Y + 60);

  return (
    <svg
      viewBox={`0 0 260 ${svgH}`}
      className="w-full max-w-[220px] shrink-0"
      style={{ height: 160 }}
      aria-hidden
    >
      {/* 5선 */}
      {[0, 1, 2, 3, 4].map((i) => (
        <line key={i} x1={38} y1={BOT_Y - i * GAP} x2={220} y2={BOT_Y - i * GAP}
          stroke="#999" strokeWidth="1.2" />
      ))}

      {/* 음자리표 */}
      <text
        x={40}
        y={clef === "treble" ? BOT_Y + HALF * 1.4 : BOT_Y - GAP + 4}
        fontSize={clef === "treble" ? GAP * 4.6 : GAP * 2.9}
        fontFamily="serif"
        fill="#555"
        style={{ userSelect: "none" }}
      >
        {clef === "treble" ? "𝄞" : "𝄢"}
      </text>

      {/* 보조선 */}
      {ledgers.map((y, i) => (
        <line key={i} x1={NX - 16} y1={y} x2={NX + 16} y2={y}
          stroke="#999" strokeWidth="1.2" />
      ))}

      {/* 임시표 */}
      {sharp && (
        <text x={NX - 22} y={noteY + 5} fontSize={15} fontFamily="serif" fill="#333">♯</text>
      )}

      {/* 음표 머리 */}
      <ellipse
        cx={NX} cy={noteY} rx={9} ry={6.5}
        fill="#111"
        transform={`rotate(-18 ${NX} ${noteY})`}
      />

      {/* 기둥 */}
      {stemUp
        ? <line x1={NX + 8} y1={noteY} x2={NX + 8} y2={noteY - HALF * 6.5}
            stroke="#111" strokeWidth="1.6" />
        : <line x1={NX - 8} y1={noteY} x2={NX - 8} y2={noteY + HALF * 6.5}
            stroke="#111" strokeWidth="1.6" />
      }
    </svg>
  );
}

// ── 메인 컴포넌트 ────────────────────────────────────────────────────────
export default function KeysPage() {
  const [active,  setActive]  = useState(69);
  const [pressed, setPressed] = useState<Set<number>>(new Set());
  const [sustain, setSustain] = useState(false);

  const sustainRef = useRef(sustain);
  useEffect(() => {
    sustainRef.current = sustain;
  }, [sustain]);

  const whites = PIANO_KEYS.filter((k) => !k.isBlack);
  const w      = 100 / whites.length;
  const key    = PIANO_KEYS[active - 21];

  function playNote(midi: number) {
    const ctx = getAudioContext(); // 사용자 제스처 안에서 resume() 시작
    const doPlay = () =>
      playPianoNote(ctx, midi, ctx.currentTime + 0.015, { sustainPedal: sustainRef.current });

    if (ctx.state === "running") {
      doPlay();
    } else {
      // context가 resume될 때까지 기다렸다가 재생
      const onState = () => {
        if (ctx.state === "running") {
          ctx.removeEventListener("statechange", onState);
          doPlay();
        }
      };
      ctx.addEventListener("statechange", onState);
    }
  }

  function pressKey(midi: number) {
    setActive(midi);
    setPressed((p) => new Set([...p, midi]));
    playNote(midi);
  }

  function releaseKey(midi: number) {
    setPressed((p) => { const n = new Set(p); n.delete(midi); return n; });
  }

  useEffect(() => {
    const MAP: Record<string, number> = {
      a:60, w:61, s:62, e:63, d:64, f:65, t:66,
      g:67, y:68, h:69, u:70, j:71, k:72,
    };
    const down = (e: KeyboardEvent) => {
      const m = MAP[e.key.toLowerCase()];
      if (m && !e.repeat) {
        setActive(m);
        setPressed((p) => new Set([...p, m]));
        const ctx = getAudioContext();
        const doPlay = () =>
          playPianoNote(ctx, m, ctx.currentTime + 0.015, { sustainPedal: sustainRef.current });
        if (ctx.state === "running") doPlay();
        else {
          const h = () => { if (ctx.state === "running") { ctx.removeEventListener("statechange", h); doPlay(); } };
          ctx.addEventListener("statechange", h);
        }
      }
    };
    const up = (e: KeyboardEvent) => {
      const m = MAP[e.key.toLowerCase()];
      if (m) setPressed((p) => { const n = new Set(p); n.delete(m); return n; });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []); // sustainRef로 sustain 값 참조 — [] 안전

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-2xl font-bold">피아노 88건반 주파수</h1>
        <p className="text-sm text-ink-soft">
          f = 440 × 2^((n − 49) / 12) · 건반을 누르거나 PC 키보드 A~K
        </p>
      </header>

      {/* 오선지 + 정보 카드 */}
      <div className="flex items-center gap-4 rounded-3xl border border-line bg-surface p-4">
        <NoteStaff midi={active} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-4xl font-bold tabular-nums">{key.name}</p>
          <p className="tabular-nums text-sm text-ink-soft">{key.freq.toFixed(2)} Hz</p>
          <p className="tabular-nums text-sm text-ink-soft">MIDI {key.midi} · {key.keyNumber}/88</p>
        </div>
      </div>

      {/* 건반 */}
      <div className="overflow-x-auto pb-2">
        <div className="relative flex h-40 min-w-[900px] select-none touch-manipulation">

          {/* 흰 건반 */}
          {whites.map((k) => {
            const isPressed = pressed.has(k.midi);
            const isActive  = active === k.midi;
            return (
              <button
                key={k.midi}
                type="button"
                onPointerDown={() => pressKey(k.midi)}
                onPointerUp={() => releaseKey(k.midi)}
                onPointerLeave={() => releaseKey(k.midi)}
                onPointerCancel={() => releaseKey(k.midi)}
                className={[
                  "relative flex-1 rounded-b border border-line transition-all duration-75",
                  isPressed
                    ? "translate-y-0.5 bg-accent/30 shadow-[inset_0_3px_6px_rgba(0,0,0,0.15)]"
                    : isActive
                    ? "bg-accent/15"
                    : "bg-white hover:bg-neutral-50",
                ].join(" ")}
                aria-label={`${k.name} ${k.freq.toFixed(2)}Hz`}
              >
                {k.name.startsWith("C") && (
                  <span className="absolute inset-x-0 bottom-1 text-[10px] text-neutral-400">
                    {k.name}
                  </span>
                )}
              </button>
            );
          })}

          {/* 검은 건반 */}
          {PIANO_KEYS.filter((k) => k.isBlack).map((k) => {
            const i = whites.findIndex((x) => x.midi === k.midi - 1);
            const isPressed = pressed.has(k.midi);
            return (
              <button
                key={k.midi}
                type="button"
                onPointerDown={() => pressKey(k.midi)}
                onPointerUp={() => releaseKey(k.midi)}
                onPointerLeave={() => releaseKey(k.midi)}
                onPointerCancel={() => releaseKey(k.midi)}
                className={[
                  "absolute top-0 z-10 h-24 rounded-b transition-all duration-75",
                  isPressed
                    ? "translate-y-1 bg-neutral-600"
                    : active === k.midi
                    ? "bg-accent"
                    : "bg-neutral-900 hover:bg-neutral-700",
                ].join(" ")}
                style={{ left: `${(i + 1) * w - w * 0.32}%`, width: `${w * 0.64}%` }}
                aria-label={`${k.name} ${k.freq.toFixed(2)}Hz`}
              />
            );
          })}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={sustain}
          onChange={(e) => setSustain(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        서스테인 페달 (감쇠 2.5배)
      </label>

      <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer font-semibold">전체 주파수 표 보기</summary>
        <table className="mt-3 w-full tabular-nums">
          <thead className="text-left text-ink-soft">
            <tr>
              <th className="py-1">건반</th><th>음이름</th><th>MIDI</th>
              <th className="text-right">Hz</th>
            </tr>
          </thead>
          <tbody>
            {PIANO_KEYS.map((k) => (
              <tr key={k.midi}
                className={`border-t border-line ${k.midi === active ? "text-accent" : ""}`}>
                <td className="py-1">{k.keyNumber}</td>
                <td>{k.name}</td>
                <td>{k.midi}</td>
                <td className="text-right">{k.freq.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}
