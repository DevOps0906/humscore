"use client";

import { useEffect, useRef, useState } from "react";
import { Mic, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { loadManualLatencyMs, saveManualLatencyMs } from "@/lib/audio/latency";
import { MIN_RMS, startPitchTracking, type TrackerSession } from "@/lib/audio/pitch-tracker";
import { freqToNearestMidi, midiToName } from "@/lib/music/frequency";
import { SettingsSection } from "./settings-section";

type MicState = "idle" | "starting" | "on";

function micError(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") return "마이크 권한이 거부됐어요. 브라우저(또는 기기) 설정에서 허용해 주세요.";
  if (name === "NotFoundError") return "연결된 마이크를 찾지 못했어요.";
  if (name === "NotSupportedError" && e instanceof DOMException) return e.message;
  return "마이크를 켜지 못했어요. 다른 앱이 마이크를 쓰고 있지 않은지 확인해 주세요.";
}

/**
 * 마이크 점검: 입력 레벨과 감지된 음만 화면에 보여 준다.
 * 소리는 저장·전송하지 않으며(음정 숫자도 버림), 화면을 떠나면 마이크를 바로 끈다.
 */
export function MicCheckSection() {
  const [state, setState] = useState<MicState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [heard, setHeard] = useState(false);
  const [latencyMs, setLatencyMs] = useState(0);
  const session = useRef<TrackerSession | null>(null);
  const abort = useRef<AbortController | null>(null);
  const level = useRef(0);
  const pendingNote = useRef<string | null>(null);
  const bar = useRef<HTMLDivElement>(null);

  // 저장된 지연 보정값 복원 (녹음 화면과 같은 값, 하이드레이션 후 읽음)
  useEffect(() => {
    const t = setTimeout(() => setLatencyMs(loadManualLatencyMs()), 0);
    return () => clearTimeout(t);
  }, []);

  // 화면을 떠나면(Activity 로 숨겨져도) 마이크 즉시 해제
  useEffect(
    () => () => {
      abort.current?.abort();
      abort.current = null;
      session.current?.stop();
      session.current = null;
      setState("idle");
    },
    [],
  );

  // 켜져 있는 동안만 레벨 미터를 그린다
  useEffect(() => {
    if (state !== "on") return;
    let raf = 0;
    const draw = () => {
      const db = level.current > 0 ? 20 * Math.log10(level.current) : -60; // RMS → dBFS(-60~0)
      if (bar.current) bar.current.style.width = `${Math.max(0, Math.min(100, ((db + 60) / 60) * 100))}%`;
      if (level.current >= MIN_RMS) setHeard(true);
      setNote(pendingNote.current);
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(raf);
  }, [state]);

  function stop() {
    abort.current?.abort();
    abort.current = null;
    session.current?.stop(); // 반환되는 프레임은 버린다
    session.current = null;
    level.current = 0;
    pendingNote.current = null;
    if (bar.current) bar.current.style.width = "0%";
    setNote(null);
    setState("idle");
  }

  async function start() {
    setError(null);
    setHeard(false);
    setState("starting");
    const ac = new AbortController();
    abort.current = ac;
    try {
      const s = await startPitchTracking({
        bpm: 90,
        beatsPerMeasure: 4,
        countInMeasures: 0,
        metronome: false,
        manualLatencyMs: latencyMs,
        signal: ac.signal,
        onLevel: (rms) => (level.current = rms),
        onFrame: (f) => {
          pendingNote.current = f.freq !== null && f.clarity >= 0.88 ? midiToName(freqToNearestMidi(f.freq)) : null;
        },
        onEnded: () => {
          stop();
          setError("마이크 연결이 끊겼어요.");
        },
      });
      if (ac.signal.aborted) {
        s.stop();
        return;
      }
      session.current = s;
      setState("on");
    } catch (e) {
      if (ac.signal.aborted) return; // 화면 이탈·정지로 취소됨
      abort.current = null;
      setState("idle");
      setError(micError(e));
    }
  }

  function changeLatency(ms: number) {
    setLatencyMs(ms);
    saveManualLatencyMs(ms);
  }

  const on = state === "on";

  return (
    <SettingsSection id="mic" title="마이크 점검" description="소리가 잘 들어오는지 확인해요. 소리는 저장·전송되지 않아요.">
      <div className="flex flex-wrap items-center gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={on || state === "starting" ? stop : start}
          className={`h-11 gap-2 lg:h-9 ${on ? "border-tune-bad text-tune-bad hover:text-tune-bad" : "border-accent text-accent hover:bg-accent/10 hover:text-accent"}`}
        >
          {on ? <Square aria-hidden /> : <Mic aria-hidden />}
          {on ? "점검 끝내기" : state === "starting" ? "마이크 켜는 중… (취소)" : "마이크 점검 시작"}
        </Button>
        <span className="text-sm text-ink-soft" aria-live="polite">
          {on ? (heard ? "소리가 들어오고 있어요" : "소리를 내 보세요") : ""}
        </span>
      </div>
      <div className="grid gap-2 text-sm">
        <div className="flex items-center gap-3 text-xs text-ink-soft">
          <span className="w-14 shrink-0">입력 레벨</span>
          <div className="relative h-1.5 flex-1 overflow-hidden rounded-full bg-line" aria-hidden>
            <div ref={bar} className="h-full w-0 rounded-full bg-accent" />
          </div>
        </div>
        <p className="text-xs text-ink-soft">
          감지된 음: <span className="tabular-nums text-ink">{on && note ? note : "–"}</span>
        </p>
      </div>
      {error && <p role="alert" className="text-sm text-tune-bad">{error}</p>}
      <div className="grid gap-1 text-sm">
        <label className="flex items-center gap-3">
          <span className="w-20 shrink-0 text-ink-soft">지연 보정(ms)</span>
          <input type="range" min={0} max={400} step={10} value={latencyMs} onChange={(e) => changeLatency(+e.target.value)} className="min-w-0 flex-1 accent-accent" />
          <span className="w-16 text-right tabular-nums">{latencyMs} ms</span>
        </label>
        <p className="text-xs text-ink-soft">녹음 화면과 같은 값이에요. 블루투스 이어폰이면 올려 주세요.</p>
      </div>
    </SettingsSection>
  );
}
