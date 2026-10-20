"use client";
import { Suspense } from "react";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DurationPicker } from "@/components/note-editor";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { BASS_CLEF_PATH, CLEF_UNITS_PER_SPACE, TREBLE_CLEF_PATH } from "@/components/clef-glyphs";
import { ScoreView } from "@/components/score-view";
import { TitleDialog } from "@/components/title-dialog";
import { MidiConnectButton } from "@/components/midi-connect-button";
import { usePianoSound } from "@/hooks/use-piano-sound";
import { useInstrument } from "@/hooks/use-instrument";
import { useMidiInput } from "@/hooks/use-midi-input";
import { getAudioContext } from "@/lib/audio/context";
import { INSTRUMENT_LABELS, INSTRUMENT_ORDER, isInstrumentId } from "@/lib/audio/instruments";
import { appendNote, createBlankScore, deleteNote, scoreMeasureCount } from "@/lib/music/edit";
import { PIANO_KEYS } from "@/lib/music/frequency";
import { beatsPerMeasureOf, METERS } from "@/lib/music/meter";
import { buildProgression, PROGRESSIONS } from "@/lib/music/progressions";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import { fifthsFor, keyName, suggestChords } from "@/lib/music/theory";
import type { KeyInfo, Meter, NoteEvent } from "@/lib/music/types";
import { AUTO_PROGRESSION, parseKeysDraft, serializeKeysDraft } from "@/lib/storage/keys-draft";
import { saveScore } from "@/lib/storage/scores";

const DRAFT_KEY = "humscore.keysDraft";

function loadDraft() {
  try {
    return parseKeysDraft(localStorage.getItem(DRAFT_KEY));
  } catch {
    return null;
  }
}

/** 조 선택 목록: 으뜸음 12개 (표기는 theory.keyName) */
const TONICS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11].map((t) => ({
  tonic: t,
  label: keyName({ tonic: t, mode: "major", fifths: fifthsFor(t, "major") }),
}));

const selectCls =
  "h-11 rounded-lg border border-line bg-surface px-3 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring lg:h-9";

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
          stroke="var(--ink-soft)" strokeWidth="1.2" />
      ))}

      {/* 음자리표 */}
      <path
        d={clef === "treble" ? TREBLE_CLEF_PATH : BASS_CLEF_PATH}
        transform={`translate(42 ${clef === "treble" ? BOT_Y - GAP : BOT_Y - 3 * GAP}) scale(${GAP / CLEF_UNITS_PER_SPACE})`}
        fill="currentColor"
      />

      {/* 보조선 */}
      {ledgers.map((y, i) => (
        <line key={i} x1={NX - 16} y1={y} x2={NX + 16} y2={y}
          stroke="var(--ink-soft)" strokeWidth="1.2" />
      ))}

      {/* 임시표 */}
      {sharp && (
        <text x={NX - 22} y={noteY + 5} fontSize={15} fontFamily="serif" fill="currentColor">♯</text>
      )}

      {/* 음표 머리 */}
      <ellipse
        cx={NX} cy={noteY} rx={9} ry={6.5}
        fill="currentColor"
        transform={`rotate(-18 ${NX} ${noteY})`}
      />

      {/* 기둥 */}
      {stemUp
        ? <line x1={NX + 8} y1={noteY} x2={NX + 8} y2={noteY - HALF * 6.5}
            stroke="currentColor" strokeWidth="1.6" />
        : <line x1={NX - 8} y1={noteY} x2={NX - 8} y2={noteY + HALF * 6.5}
            stroke="currentColor" strokeWidth="1.6" />
      }
    </svg>
  );
}

const PC_MAP: Record<string, number> = {
  a: 60, w: 61, s: 62, e: 63, d: 64, f: 65, t: 66,
  g: 67, y: 68, h: 69, u: 70, j: 71, k: 72,
};

function KeysPageInner() {
  const router = useRouter();
  const [instrument, setInstrument] = useInstrument();
  const { playNote, sustain, setSustain } = usePianoSound(instrument);
  const [active, setActive] = useState(69);
  const [pressed, setPressed] = useState<Set<number>>(new Set());

  const [entry, setEntry] = useState(false);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [bpm, setBpm] = useState(90);
  const [meter, setMeter] = useState<Meter>("4/4");
  const beats = beatsPerMeasureOf(meter);
  const [tonic, setTonic] = useState(0);
  const [mode, setMode] = useState<"major" | "minor">("major");
  const [progressionId, setProgressionId] = useState(AUTO_PROGRESSION);
  const [dur, setDur] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [defaultTitle, setDefaultTitle] = useState("");
  const [base] = useState(() => createBlankScore());

  // 초안 복원 / 저장 (음표 숫자만, 오디오 아님)
  useEffect(() => {
    const t = setTimeout(() => {
      const d = loadDraft();
      if (d && d.notes.length > 0) {
        setNotes(d.notes);
        setBpm(d.bpm || 90);
        setMeter(d.meter);
        setTonic(d.key.tonic);
        setMode(d.key.mode);
        setProgressionId(d.progressionId);
        setEntry(true);
      }
      if (new URLSearchParams(window.location.search).get("entry") === "1") setEntry(true);
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (notes.length === 0) localStorage.removeItem(DRAFT_KEY);
      else {
        localStorage.setItem(
          DRAFT_KEY,
          serializeKeysDraft({ notes, bpm, meter, key: { tonic, mode, fifths: fifthsFor(tonic, mode) }, progressionId }),
        );
      }
    } catch {
      /* 저장 불가 환경 무시 */
    }
  }, [notes, bpm, meter, tonic, mode, progressionId, loaded]);

  // 조는 사용자가 고른 값 그대로 (음을 눌러도 조표가 바뀌지 않음)
  const draftScore = useMemo(() => {
    const key: KeyInfo = { tonic, mode, fifths: fifthsFor(tonic, mode) };
    return { ...base, notes, bpm, meter, beatsPerMeasure: beatsPerMeasureOf(meter), key };
  }, [base, notes, bpm, meter, tonic, mode]);
  const xml = useMemo(
    () => (entry ? scoreToMusicXML(draftScore, "lead", { minMeasures: 8, measuresPerSystem: 4 }) : ""),
    [entry, draftScore],
  );

  // PC 키보드/건반 핸들러가 최신 상태를 보도록 ref 사용
  const handler = useRef<(midi: number) => void>(() => {});
  useEffect(() => {
    handler.current = (midi: number) => {
      setActive(midi);
      playNote(midi);
      if (entry) setNotes((n) => appendNote(n, midi, dur));
    };
  });

  // 외부 MIDI 건반: 화면 건반을 누른 것과 같은 경로(handler)로 처리
  const midi = useMidiInput({
    onEvent: (e) => {
      if (e.type === "pedal") {
        setSustain(e.down);
        return;
      }
      if (e.midi < 21 || e.midi > 108) return;
      if (e.type === "on") {
        setPressed((p) => new Set([...p, e.midi]));
        handler.current(e.midi);
      } else {
        setPressed((p) => { const n = new Set(p); n.delete(e.midi); return n; });
      }
    },
  });
  function connectMidiKeyboard() {
    // 사용자 제스처 안에서 동기 호출 — MIDI 이벤트는 제스처가 아니므로 미리 AudioContext를 깨워 둔다
    const ctx = getAudioContext();
    void ctx.resume();
    void midi.connect();
  }

  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA")) return;
      const m = PC_MAP[e.key.toLowerCase()];
      if (m && !e.repeat) {
        setPressed((p) => new Set([...p, m]));
        handler.current(m);
      }
    };
    const up = (e: KeyboardEvent) => {
      const m = PC_MAP[e.key.toLowerCase()];
      if (m) setPressed((p) => { const n = new Set(p); n.delete(m); return n; });
    };
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    return () => { window.removeEventListener("keydown", down); window.removeEventListener("keyup", up); };
  }, []);

  const key = PIANO_KEYS[active - 21];

  function openTitleDialog() {
    if (notes.length === 0) return;
    setDefaultTitle(`건반 입력 ${new Date().toLocaleString("ko-KR")}`);
    setTitleOpen(true);
  }

  async function save(result: { title: string; composer?: string; lyricist?: string; arranger?: string }) {
    if (notes.length === 0) return;
    // 선택한 코드 진행, "자동 추천"이면 마디별 코드를 추천 (악보 화면에서 수정 가능)
    const measures = scoreMeasureCount(draftScore);
    const chords =
      progressionId === AUTO_PROGRESSION
        ? suggestChords(notes, draftScore.key, beats, measures)
        : buildProgression(progressionId, draftScore.key, measures, beats);
    const saved = await saveScore({ ...draftScore, chords, ...result });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* 무시 */ }
    setTitleOpen(false); // 이동 전에 닫아 대화상자가 DOM 에 남지 않게 함
    router.push(`/scores/${saved.id}`);
  }

  const btn = "h-11 rounded-full px-4 text-sm lg:h-9";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">피아노 88건반 주파수</h1>
          <p className="text-sm text-ink-soft">
            f = 440 × 2^((n − 49) / 12) · 건반을 누르거나 PC 키보드 A~K
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
        <label className="flex items-center gap-2 text-sm">
          <span className="text-ink-soft">악기</span>
          <select
            aria-label="악기 음색"
            value={instrument}
            onChange={(e) => isInstrumentId(e.target.value) && setInstrument(e.target.value)}
            className={selectCls}
          >
            {INSTRUMENT_ORDER.map((id) => (
              <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
            ))}
          </select>
        </label>
        <Button
          type="button"
          variant="outline"
          onClick={() => setEntry((v) => !v)}
          aria-pressed={entry}
          className={`h-11 rounded-full px-4 text-sm lg:h-9 ${entry ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
        >
          악보 입력
        </Button>
        </div>
      </header>

      <MidiConnectButton
        status={midi.supported ? midi.status : "unsupported"}
        devices={midi.devices}
        message={midi.message}
        onConnect={connectMidiKeyboard}
      />

      {/* 입력 도구 */}
      {entry && (
        <Card className="gap-3 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <label className="flex items-center gap-2">
              조
              <select
                aria-label="으뜸음"
                value={tonic}
                onChange={(e) => setTonic(Number(e.target.value))}
                className={selectCls}
              >
                {TONICS.map((t) => (
                  <option key={t.tonic} value={t.tonic}>{t.label}</option>
                ))}
              </select>
            </label>
            {(["major", "minor"] as const).map((m) => (
              <Button
                key={m}
                type="button"
                variant="outline"
                onClick={() => setMode(m)}
                aria-pressed={mode === m}
                className={`h-11 rounded-full px-4 lg:h-9 ${mode === m ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
              >
                {m === "major" ? "장조" : "단조"}
              </Button>
            ))}
            <span className="text-ink-soft">{keyName(draftScore.key)} · 조표 {Math.abs(draftScore.key.fifths)}{draftScore.key.fifths < 0 ? "♭" : draftScore.key.fifths > 0 ? "♯" : ""}</span>
          </div>
          <p className="text-xs text-ink-soft">
            {notes.length === 0
              ? "먼저 조를 고른 뒤 건반을 눌러 입력하세요. 음 길이를 고르면 악보에 추가돼요."
              : "음 길이를 고르고 건반을 누르면 악보에 추가돼요. 조를 바꿔도 음높이는 그대로예요."}
          </p>
          <DurationPicker value={dur} onChange={setDur} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" variant="outline" className={btn} onClick={() => setNotes((n) => appendNote(n, null, dur))}>쉼표 추가</Button>
            <Button type="button" variant="outline" className={btn} disabled={notes.length === 0} onClick={() => setNotes((n) => deleteNote(n, n.length - 1))}>되돌리기</Button>
            <Button
              type="button"
              variant="destructive"
              className={btn}
              disabled={notes.length === 0}
              onClick={() => setConfirmClear(true)}
            >
              전체 지우기
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">
              BPM
              <Input
                type="number"
                min={30}
                max={240}
                value={bpm}
                onChange={(e) => setBpm(Math.min(240, Math.max(30, Number(e.target.value) || 90)))}
                className="h-11 w-20 lg:h-9"
              />
            </label>
            {METERS.map((m) => (
              <Button
                key={m.id}
                type="button"
                variant="outline"
                onClick={() => setMeter(m.id)}
                aria-pressed={meter === m.id}
                className={`h-11 rounded-full px-4 lg:h-9 ${meter === m.id ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
              >
                {m.label}
              </Button>
            ))}
            <span className="text-ink-soft">{notes.length}개 음표</span>
          </div>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            코드 진행
            <select
              aria-label="코드 진행"
              value={progressionId}
              onChange={(e) => setProgressionId(e.target.value)}
              className={`${selectCls} min-w-0 max-w-full`}
            >
              <option value={AUTO_PROGRESSION}>자동 추천</option>
              {PROGRESSIONS.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({mode === "minor" ? p.minorRoman : p.roman})
                </option>
              ))}
            </select>
          </label>
        </Card>
      )}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="음표를 모두 지울까요?"
        description="작성 중인 음표가 모두 사라져요."
        confirmLabel="모두 지우기"
        onConfirm={() => setNotes([])}
      />

      {/* 건반 */}
      <PianoKeyboard active={active} pressed={pressed} onPress={(m) => handler.current(m)} />

      {/* 악보 미리보기 (건반 바로 아래) */}
      {entry && <ScoreView xml={xml} />}

      {/* 오선지 + 정보 카드 */}
      <Card className="flex-row items-center gap-4 p-4">
        <NoteStaff midi={active} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-4xl font-bold tabular-nums">{key.name}</p>
          <p className="tabular-nums text-sm text-ink-soft">{key.freq.toFixed(2)} Hz</p>
          <p className="tabular-nums text-sm text-ink-soft">MIDI {key.midi} · {key.keyNumber}/88</p>
        </div>
      </Card>

      <label className={`flex min-h-11 items-center gap-2 text-sm ${instrument === "piano" ? "" : "opacity-50"}`}>
        <input
          type="checkbox"
          checked={sustain}
          disabled={instrument !== "piano"}
          onChange={(e) => setSustain(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        서스테인 페달 (감쇠 2.5배){instrument !== "piano" && " · 피아노에서만 사용"}
      </label>

      {entry && (
        <Button type="button" disabled={notes.length === 0} onClick={openTitleDialog} className="h-11 w-full text-sm">
          악보로 저장
        </Button>
      )}
      <TitleDialog
        open={titleOpen}
        defaultTitle={defaultTitle}
        onConfirm={save}
        onCancel={() => setTitleOpen(false)}
      />


      <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
        <summary className="cursor-pointer rounded-sm font-semibold outline-none focus-visible:ring-3 focus-visible:ring-ring/60">전체 주파수 표 보기</summary>
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

export default function KeysPage() {
  return (
    <Suspense fallback={null}>
      <KeysPageInner />
    </Suspense>
  );
}
