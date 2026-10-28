"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { startPitchTracking, type TrackerSession } from "@/lib/audio/pitch-tracker";
import type { MidiEvent } from "@/lib/audio/midi-input";
import {
  buildFollowPlan,
  createFollowState,
  judge,
  resetFollow,
  type FollowInput,
  type FollowResultKind,
  type FollowState,
} from "@/lib/music/follow";
import type { Score } from "@/lib/music/types";
import { useMidiInput } from "@/hooks/use-midi-input";

export type FollowInputKind = "mic" | "midi";
/** idle: 시작 전 / running: 대기·진행 / paused: 일시정지 / done: 끝까지 침 */
export type FollowPhase = "idle" | "running" | "paused" | "done";

export interface FollowFeedback {
  kind: Exclude<FollowResultKind, "none" | "done">;
  heard: number;
  target: number;
}

function micErrorMessage(e: unknown): string {
  const name = e instanceof DOMException ? e.name : "";
  if (name === "NotAllowedError") return "마이크 권한이 필요해요. 주소창의 사이트 설정에서 마이크를 허용해 주세요.";
  if (name === "NotFoundError") return "마이크를 찾을 수 없어요. 기기에 마이크가 연결되어 있는지 확인해 주세요.";
  if (name === "NotSupportedError") return "이 환경에서는 마이크를 쓸 수 없어요. HTTPS 또는 앱에서 실행해 주세요.";
  if (name === "NotReadableError") return "마이크가 다른 앱에서 사용 중이에요. 다른 앱을 닫고 다시 시도해 주세요.";
  return "마이크를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.";
}

/**
 * 따라 치기(기다리기 모드): 마이크 프레임·MIDI 입력을 judge 에 연결한다.
 * 오디오는 저장·전송하지 않고 주파수·판정 결과만 메모리에서 쓴다.
 * start() 는 버튼 클릭 핸들러에서 호출할 것 (마이크·MIDI 권한은 사용자 제스처 필요).
 */
export function useFollowAlong(score: Score | null | undefined) {
  const plan = useMemo(() => (score ? buildFollowPlan(score) : { targets: [], noteIndexes: [], hasChord: false }), [score]);
  const targets = plan.targets;
  const map = plan;
  const targetsKey = targets.join(",");

  const [phase, setPhase] = useState<FollowPhase>("idle");
  const [inputKind, setInputKind] = useState<FollowInputKind>("mic");
  const [error, setError] = useState("");
  const [index, setIndex] = useState(0);
  const [wrongCount, setWrongCount] = useState(0);
  const [feedback, setFeedback] = useState<FollowFeedback | null>(null);
  const [elapsedMs, setElapsedMs] = useState(0);

  const stateRef = useRef<FollowState | null>(null);
  const phaseRef = useRef<FollowPhase>("idle");
  const trackerRef = useRef<TrackerSession | null>(null);
  const token = useRef(0);
  const rmsRef = useRef(0);
  const inputKindRef = useRef<FollowInputKind>("mic");

  const setPhaseBoth = useCallback((p: FollowPhase) => {
    phaseRef.current = p;
    setPhase(p);
  }, []);

  const stopMic = useCallback(() => {
    token.current++; // 진행 중인 시작 요청 무효화
    trackerRef.current?.stop();
    trackerRef.current = null;
  }, []);

  const feed = useCallback(
    (input: FollowInput) => {
      const st = stateRef.current;
      if (!st || phaseRef.current !== "running") return;
      const { state, result } = judge(st, input, performance.now());
      stateRef.current = state;
      if (result.kind === "none" || result.kind === "done") return;
      setIndex(state.index);
      setWrongCount(state.wrongCount);
      setFeedback({ kind: result.kind, heard: result.heard as number, target: result.target as number });
      if (result.finished) {
        setElapsedMs((state.finishedAtMs ?? performance.now()) - state.startedAtMs);
        setPhaseBoth("done");
        queueMicrotask(stopMic); // onFrame 은 tracker tick 안에서 불리므로 정지는 tick 밖에서
      }
    },
    [setPhaseBoth, stopMic],
  );

  const midi = useMidiInput({
    onEvent: (e: MidiEvent) => {
      if (e.type === "on" && inputKindRef.current === "midi") feed({ kind: "midi", midi: e.midi });
    },
  });
  const midiConnect = midi.connect;

  const startMic = useCallback(async (): Promise<boolean> => {
    const my = ++token.current;
    try {
      const s = await startPitchTracking({
        bpm: 60,
        beatsPerMeasure: 4,
        countInMeasures: 0,
        metronome: false,
        onLevel: (rms) => {
          rmsRef.current = rms;
        },
        onFrame: (f) => feed({ kind: "frame", freq: f.freq, clarity: f.clarity, rms: rmsRef.current }),
        onEnded: () => {
          if (phaseRef.current === "running") {
            stopMic();
            setPhaseBoth("paused");
            setError("마이크 연결이 끊겨 일시정지했어요. 다시 시작을 눌러 주세요.");
          }
        },
      });
      if (my !== token.current) {
        s.stop();
        return false;
      }
      trackerRef.current = s;
      return true;
    } catch (e) {
      if (my === token.current) setError(micErrorMessage(e));
      return false;
    }
  }, [feed, setPhaseBoth, stopMic]);

  /** 처음 시작 또는 입력 바꿔 시작 */
  const start = useCallback(
    async (kind: FollowInputKind) => {
      if (targets.length === 0) return;
      setError("");
      setInputKind(kind);
      inputKindRef.current = kind;
      stopMic();
      let ok: boolean;
      if (kind === "mic") ok = await startMic();
      else {
        if (!midi.supported) {
          setError(midi.message || "이 브라우저는 MIDI 건반을 지원하지 않아요.");
          return;
        }
        ok = await midiConnect();
        if (!ok) {
          setError("MIDI 건반을 연결하지 못했어요. 건반 연결과 권한을 확인하거나 마이크로 시작해 주세요.");
          return;
        }
      }
      if (!ok) return;
      stateRef.current = createFollowState(targets, performance.now());
      setIndex(0);
      setWrongCount(0);
      setFeedback(null);
      setElapsedMs(0);
      setPhaseBoth("running");
    },
    [targets, stopMic, startMic, midi.supported, midi.message, midiConnect, setPhaseBoth],
  );

  const pause = useCallback(() => {
    if (phaseRef.current !== "running") return;
    stopMic();
    setPhaseBoth("paused");
  }, [stopMic, setPhaseBoth]);

  /** 일시정지 뒤 같은 음에서 이어서 */
  const resume = useCallback(async () => {
    if (phaseRef.current !== "paused") return;
    setError("");
    if (inputKind === "mic" && !(await startMic())) return;
    setPhaseBoth("running");
  }, [inputKind, startMic, setPhaseBoth]);

  /** 처음부터 다시 (끝 화면의 "다시 하기" 포함) */
  const restart = useCallback(async () => {
    const st = stateRef.current;
    if (!st) return;
    setError("");
    if (inputKind === "mic" && !trackerRef.current && !(await startMic())) return;
    stateRef.current = resetFollow(st, performance.now());
    setIndex(0);
    setWrongCount(0);
    setFeedback(null);
    setElapsedMs(0);
    setPhaseBoth("running");
  }, [inputKind, startMic, setPhaseBoth]);

  const end = useCallback(() => {
    stopMic();
    stateRef.current = null;
    setError("");
    setFeedback(null);
    setIndex(0);
    setPhaseBoth("idle");
  }, [stopMic, setPhaseBoth]);

  // 전조 등으로 목표가 바뀌면 진행 중 판정이 어긋나므로 처음 상태로
  const lastKey = useRef(targetsKey);
  useEffect(() => {
    if (lastKey.current === targetsKey) return;
    lastKey.current = targetsKey;
    if (phaseRef.current !== "idle") end();
  }, [targetsKey, end]);

  // 언마운트 시 마이크 트랙 정지
  useEffect(
    () => () => {
      token.current++;
      trackerRef.current?.stop();
      trackerRef.current = null;
    },
    [],
  );

  const active = phase === "running" || phase === "paused";
  const currentTarget = !active ? null : (targets[index] ?? null);
  const currentNoteIndex = !active ? null : (map.noteIndexes[index] ?? null);

  return {
    phase,
    inputKind,
    error,
    targets,
    total: targets.length,
    index,
    wrongCount,
    feedback,
    elapsedMs,
    currentTarget,
    currentNoteIndex,
    hasChord: map.hasChord,
    midiSupported: midi.supported,
    midiStatus: midi.status,
    midiDevices: midi.devices,
    midiMessage: midi.message,
    start,
    pause,
    resume,
    restart,
    end,
  };
}
