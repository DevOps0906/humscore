"use client";
import { Suspense } from "react";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Capacitor } from "@capacitor/core";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { loadManualLatencyMs, saveManualLatencyMs } from "@/lib/audio/latency";
import { MIN_RMS, startPitchTracking, type TrackerSession } from "@/lib/audio/pitch-tracker";
import { getAudioContext } from "@/lib/audio/context";
import { centsOff, freqToNearestMidi, freqToMidiFloat, midiToName } from "@/lib/music/frequency";
import { buildScoreFromFrames } from "@/lib/music/pipeline";
import { saveScore } from "@/lib/storage/scores";
import type { PitchFrame } from "@/lib/music/types";

type Status = "idle" | "countin" | "recording" | "processing";

function RecordPageInner() {
  const router = useRouter();
  const [bpm, setBpm] = useState(90);
  const [beats, setBeats] = useState(4);
  const [metronome, setMetronome] = useState(true);
  const [status, setStatus] = useState<Status>("idle");
  const [beat, setBeat] = useState<number | null>(null);
  const [live, setLive] = useState<PitchFrame | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [latencyMs, setLatencyMs] = useState(0);
  const [noInput, setNoInput] = useState(false);
  const session = useRef<TrackerSession | null>(null);
  /** 진행 중인 start() 식별자. 마이크 권한 대기 중 정지를 누르면 null 이 되어 늦게 열린 세션을 바로 닫음 */
  const starting = useRef<object | null>(null);
  const trace = useRef<PitchFrame[]>([]);
  const level = useRef(0);
  const peakLevel = useRef(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const meter = useRef<HTMLDivElement>(null);

  // 실시간 음정 궤적 (최근 6초) + 입력 레벨 미터
  useEffect(() => {
    let raf = 0;
    const draw = () => {
      const m = meter.current;
      if (m) {
        // RMS → dBFS(-60~0) → 0~100%
        const db = level.current > 0 ? 20 * Math.log10(level.current) : -60;
        m.style.width = `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
      }
      const c = canvas.current;
      if (c) {
        const g = c.getContext("2d")!;
        const w = (c.width = c.clientWidth * devicePixelRatio);
        const h = (c.height = c.clientHeight * devicePixelRatio);
        g.clearRect(0, 0, w, h);
        const pts = trace.current;
        const now = pts.length ? pts[pts.length - 1].time : 0;
        const span = 6;
        const lo = 45, hi = 81; // A2 ~ A5
        g.strokeStyle = "rgba(147,151,171,0.25)";
        g.lineWidth = 1;
        for (let m = lo; m <= hi; m++) {
          if (m % 12 !== 0) continue; // C 위치마다 가이드선
          const y = h - ((m - lo) / (hi - lo)) * h;
          g.beginPath(); g.moveTo(0, y); g.lineTo(w, y); g.stroke();
        }
        g.fillStyle = "#f07a6e";
        for (const p of pts) {
          if (p.freq === null || p.clarity < 0.88 || now - p.time > span) continue;
          const x = w - ((now - p.time) / span) * w;
          const y = h - ((freqToMidiFloat(p.freq) - lo) / (hi - lo)) * h;
          g.beginPath(); g.arc(x, y, 2.2 * devicePixelRatio, 0, Math.PI * 2); g.fill();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(
    () => () => {
      starting.current = null; // 권한 대기 중 화면을 떠나면 늦게 열린 세션을 start()가 닫음
      session.current?.stop();
      session.current = null;
    },
    [],
  );

  // 저장된 지연 보정값 복원 (hydration 불일치 방지를 위해 마운트 후 읽음)
  useEffect(() => {
    const t = setTimeout(() => setLatencyMs(loadManualLatencyMs()), 0);
    return () => clearTimeout(t);
  }, []);

  function changeLatency(ms: number) {
    setLatencyMs(ms);
    saveManualLatencyMs(ms);
  }

  async function start() {
    if (session.current || starting.current) return; // 이미 녹음 중이거나 시작 대기 중
    setError(null);
    setNoInput(false);
    trace.current = [];
    level.current = 0;
    peakLevel.current = 0;
    const token = {};
    starting.current = token;
    try {
      getAudioContext(); // iOS: 터치 핸들러 동기 흐름 안에서 resume() 시작 (await 금지)
      setStatus("countin");
      const s = await startPitchTracking({
        bpm,
        beatsPerMeasure: beats,
        countInMeasures: 1,
        metronome,
        manualLatencyMs: latencyMs,
        onEnded: () => {
          // 마이크 track이 끊김 → 녹음 정리. 프레임이 있으면 거기까지 저장
          void finish(true);
        },
        onBeat: (b) => {
          setBeat(b);
          if (b >= 0) setStatus("recording");
          // 녹음 2박이 지나도록 입력 레벨이 게이트 아래면 마이크가 소리를 못 받는 상태
          if (b >= 2 && peakLevel.current < MIN_RMS) setNoInput(true);
        },
        onLevel: (rms) => {
          level.current = rms;
          if (rms > peakLevel.current) peakLevel.current = rms;
        },
        onFrame: (f) => {
          trace.current.push(f);
          if (trace.current.length > 600) trace.current.shift();
          setLive(f);
        },
      });
      if (starting.current !== token) {
        // 권한 대기 중에 정지를 눌렀거나 화면을 떠남 → 늦게 열린 세션 즉시 정리
        s.stop();
        return;
      }
      starting.current = null;
      session.current = s;
    } catch (e) {
      if (starting.current === token) starting.current = null;
      setStatus("idle");
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? Capacitor.isNativePlatform()
            ? "마이크 권한이 필요합니다. 설정 > 앱 > HumScore > 권한에서 마이크를 허용해 주세요."
            : "마이크 권한이 필요합니다. 주소창의 사이트 설정에서 마이크를 허용해 주세요."
          : name === "NotFoundError"
            ? "마이크를 찾을 수 없습니다. 기기에 마이크가 연결되어 있는지 확인해 주세요."
            : name === "NotSupportedError"
              ? "이 환경에서는 마이크를 사용할 수 없습니다. HTTPS 또는 앱에서 실행해 주세요."
              : name === "NotReadableError"
                ? "마이크가 다른 앱에서 사용 중입니다. 다른 앱을 닫고 다시 시도해 주세요."
                : "마이크를 시작하지 못했습니다. 잠시 후 다시 시도해 주세요.",
      );
    }
  }

  async function finish(interrupted: boolean) {
    if (!session.current) {
      // 아직 마이크 권한 대기 중(세션 없음)에 정지 → 시작 취소만 하고 조용히 대기 상태로
      starting.current = null;
      setBeat(null);
      setStatus("idle");
      return;
    }
    const frames = session.current.stop();
    session.current = null;
    setBeat(null);
    setLive(null);
    level.current = 0;
    if (interrupted && frames.length === 0) {
      setStatus("idle");
      setError("마이크 연결이 끊겼어요. 연결을 확인하고 다시 녹음해 주세요.");
      return;
    }
    setStatus("processing");
    const { score } = buildScoreFromFrames(frames, { bpm, beatsPerMeasure: beats });
    if (!score.notes.some((n) => n.midi !== null)) {
      setStatus("idle");
      setError(
        interrupted
          ? "마이크 연결이 끊겼어요. 음이 감지되지 않아 저장하지 못했어요."
          : "음이 감지되지 않았어요. 조용한 곳에서 '라~' 또는 '음~'으로 또렷하게 불러 주세요.",
      );
      return;
    }
    await saveScore(score);
    if (interrupted) toast.info("마이크 연결이 끊겨 여기까지 저장했어요.");
    router.push(`/scores/${score.id}`);
  }

  function stop() {
    return finish(false);
  }

  const voiced = live?.freq && live.clarity >= 0.88 ? live.freq : null;
  const cents = voiced ? centsOff(voiced) : 0;
  const tuneColor = Math.abs(cents) < 15 ? "text-tune-good" : Math.abs(cents) < 30 ? "text-tune-warn" : "text-tune-bad";
  const recording = status === "countin" || status === "recording";

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <header>
        <h1 className="text-2xl font-medium">흥얼거리면 악보가 됩니다</h1>
        <p className="mt-1 text-sm text-ink-soft">메트로놈에 맞춰 &lsquo;라~&rsquo;로 불러 주세요. 유선 이어폰을 쓰면 박자가 가장 정확해요.</p>
      </header>

      {/* 실시간 음정 */}
      <Card className="gap-0 rounded-2xl p-5">
        <div className="flex items-end justify-between">
          <div>
            <p className="text-xs text-ink-soft">지금 부르는 음</p>
            <p className="text-5xl font-bold tabular-nums">{voiced ? midiToName(freqToNearestMidi(voiced)) : <span className="text-ink-soft/40">–</span>}</p>
          </div>
          <div className="text-right">
            <p className="tabular-nums text-sm text-ink-soft">{voiced ? `${voiced.toFixed(1)} Hz` : " "}</p>
            <p className={`tabular-nums text-lg font-semibold ${voiced ? tuneColor : "text-ink-soft"}`}>
              {voiced ? `${cents > 0 ? "+" : ""}${cents.toFixed(0)}¢` : "음정 대기"}
            </p>
          </div>
        </div>
        <div className="relative mt-3 h-2 rounded-full bg-line">
          <div className="absolute top-1/2 h-4 w-0.5 -translate-y-1/2 bg-ink-soft" style={{ left: "50%" }} />
          {voiced && (
            <div
              className="absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent transition-[left] duration-75"
              style={{ left: `${50 + cents}%` }}
            />
          )}
        </div>
        <canvas ref={canvas} className="mt-4 h-32 w-full rounded-xl bg-paper" />
        {/* 마이크 입력 레벨 — 소리가 들어오는지 바로 확인 (값은 저장되지 않음) */}
        <div className="mt-3 flex items-center gap-3 text-xs text-ink-soft">
          <span className="w-14 shrink-0">마이크</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <div ref={meter} className="h-full w-0 rounded-full bg-accent" />
          </div>
        </div>
        {noInput && recording && (
          <p className="mt-2 text-xs text-tune-warn">마이크 입력이 거의 없어요. 다른 앱이 마이크를 쓰고 있지 않은지, 시스템 입력 음량이 0이 아닌지 확인해 주세요.</p>
        )}
      </Card>

      {/* 박자 표시 */}
      <div className="flex items-center justify-center gap-3" aria-live="polite">
        {Array.from({ length: beats }, (_, i) => {
          const on = beat !== null && ((beat % beats) + beats) % beats === i && recording;
          return <span key={i} className={`h-3 w-3 rounded-full ${on ? (i === 0 ? "bg-accent" : "bg-ink") : "bg-line"}`} />;
        })}
        <span className="ml-2 w-28 text-sm text-ink-soft">
          {status === "countin" ? "준비…" : status === "recording" ? `${Math.floor((beat ?? 0) / beats) + 1}마디` : status === "processing" ? "악보 만드는 중…" : `${bpm} BPM`}
        </span>
      </div>

      <button
        type="button"
        onClick={recording ? stop : start}
        disabled={status === "processing"}
        className={`mx-auto flex h-24 w-24 items-center justify-center rounded-full text-accent-ink shadow-md outline-none transition focus-visible:ring-4 focus-visible:ring-ring/60 active:scale-95 disabled:opacity-50 ${recording ? "bg-tune-bad" : "bg-accent"}`}
        aria-label={recording ? "녹음 끝내고 악보 만들기" : "녹음 시작"}
      >
        {recording ? (
          <Square className="size-8" fill="currentColor" aria-hidden />
        ) : (
          <Mic className="size-10" strokeWidth={2} fill="currentColor" aria-hidden />
        )}
      </button>
      {error && <p role="alert" className="text-center text-sm text-tune-bad">{error}</p>}

      {/* 설정 */}
      <Card className={`gap-4 p-4 ${recording ? "pointer-events-none opacity-50" : ""}`} aria-disabled={recording}>
        <label className="flex items-center gap-3 text-sm">
          <span className="w-14 text-ink-soft">템포</span>
          <input type="range" min={50} max={160} step={1} value={bpm} onChange={(e) => setBpm(+e.target.value)} className="flex-1 accent-accent" />
          <span className="w-16 text-right tabular-nums">{bpm} BPM</span>
        </label>
        <div className="flex items-center gap-3 text-sm">
          <span className="w-14 text-ink-soft">박자</span>
          {[2, 3, 4].map((b) => (
            <Button
              key={b}
              type="button"
              variant="outline"
              onClick={() => setBeats(b)}
              aria-pressed={beats === b}
              className={`h-11 rounded-full px-5 sm:h-9 ${beats === b ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
            >
              {b}/4
            </Button>
          ))}
        </div>
        <div className="grid gap-1 text-sm">
          <label className="flex items-center gap-3">
            <span className="w-20 shrink-0 text-ink-soft">지연 보정(ms)</span>
            <input type="range" min={0} max={400} step={10} value={latencyMs} onChange={(e) => changeLatency(+e.target.value)} className="flex-1 accent-accent" />
            <span className="w-16 text-right tabular-nums">{latencyMs} ms</span>
          </label>
          <p className="text-xs text-ink-soft">블루투스 이어폰이면 올려 주세요. 박자가 밀려 보일 때 조정합니다.</p>
        </div>
        <label className="flex min-h-11 items-center justify-between text-sm">
          <span className="text-ink-soft">녹음 중 메트로놈</span>
          <input type="checkbox" checked={metronome} onChange={(e) => setMetronome(e.target.checked)} className="h-5 w-5 accent-accent" />
        </label>
      </Card>
      <p className="text-center text-xs text-ink-soft">녹음된 목소리는 기기 밖으로 전송·저장되지 않고, 음표 정보만 남습니다.</p>
    </div>
  );
}

export default function RecordPage() {
  return (
    <Suspense fallback={null}>
      <RecordPageInner />
    </Suspense>
  );
}
