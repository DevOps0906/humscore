"use client";
import { Suspense } from "react";
import { ScorePartsPanel } from "@/components/score-parts-panel";
import { ScoreTemplateDialog } from "@/components/score-template-dialog";
import { MAIN_PART_ID, getScoreParts, scoreForPart, updateScorePart, addScorePart } from "@/lib/music/parts";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { ChordEditor } from "@/components/chord-editor";
import { CompositionDialog } from "@/components/composition-dialog";
import { CreationInstrumentSelector } from "@/components/creation-instrument-selector";
import { DrumEditor } from "@/components/drum-editor";
import { AccompanimentSettingsPanel } from "@/components/accompaniment-settings";
import type { AccompanimentSettings } from "@/lib/music/accompaniment";
import { GuitarFretboard } from "@/components/guitar-fretboard";
import { NoteChordEditor } from "@/components/note-chord-editor";
import { TabScoreView } from "@/components/tab-score-view";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { DurationPicker } from "@/components/note-editor";
import { PianoKeyboard } from "@/components/piano-keyboard";
import { BASS_CLEF_PATH, CLEF_UNITS_PER_SPACE, TREBLE_CLEF_PATH } from "@/components/clef-glyphs";
import { ScoreView } from "@/components/score-view";
import { TitleDialog } from "@/components/title-dialog";
import { MidiConnectButton } from "@/components/midi-connect-button";
import { usePianoSound } from "@/hooks/use-piano-sound";
import { useInstrument } from "@/hooks/use-instrument";
import { useMidiInput } from "@/hooks/use-midi-input";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import { playScore, type Playback } from "@/lib/audio/piano-synth";
import { ACOUSTIC_PIANOS, ELECTRIC_PIANOS, SYNTH_INSTRUMENTS, ORCHESTRA_GROUPS, INSTRUMENT_LABELS, type CreationMode, type InstrumentId } from "@/lib/music/instrument-catalog";
import { appendNote, createBlankScore, deleteNote, scoreMeasureCount } from "@/lib/music/edit";
import { PIANO_KEYS } from "@/lib/music/frequency";
import { keysCanAppend, keysPreviewMinMeasures, keysShowsScore, keysToggleInput, type KeysScorePhase } from "@/lib/music/keys-entry";
import { beatsPerMeasureOf, METERS } from "@/lib/music/meter";
import { buildProgression, PROGRESSIONS } from "@/lib/music/progressions";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import { fifthsFor, keyName, suggestChords } from "@/lib/music/theory";
import { isGuitarInstrument, type GuitarInstrumentId } from "@/lib/music/tablature";
import type { ChordEvent, KeyInfo, Meter, NoteEvent } from "@/lib/music/types";
import { AUTO_PROGRESSION, parseKeysDraft, serializeKeysDraft } from "@/lib/storage/keys-draft";
import { getScore, saveScore } from "@/lib/storage/scores";
import { loadScoreDefaults } from "@/lib/storage/preferences";

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

function calcStaff(midi: number, forceBass = false): { step: number; sharp: boolean; clef: "treble" | "bass" } {
  const pc      = ((midi % 12) + 12) % 12;
  const octave  = Math.floor(midi / 12) - 1;
  const diaton  = DIATONIC[pc];
  const sharp   = IS_SHARP[pc];
  // 트레블: 기준 E4(MIDI 64) = step 0  / 배스: 기준 G2(MIDI 43) = step 0
  const clef = forceBass ? "bass" : midi >= 48 ? "treble" : "bass";
  const step = clef === "treble"
    ? (octave - 4) * 7 + (diaton - 2)   // E4 기준
    : (octave - 2) * 7 + (diaton - 4);  // G2 기준
  return { step, sharp, clef };
}

function NoteStaff({ midi, forceBass = false }: { midi: number; forceBass?: boolean }) {
  const HALF  = 11;       // px — 한 단계(한 칸의 절반)
  const GAP   = HALF * 2; // 오선지 인접 선 간격
  const BOT_Y = 130;      // 최하단 선의 y 좌표
  const NX    = 145;      // 음표 x 좌표

  const { step, sharp, clef } = calcStaff(midi, forceBass);
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
  const [creationMode, setCreationMode] = useState<CreationMode>("piano");
  const pianoSounds: readonly InstrumentId[] = [...ACOUSTIC_PIANOS, ...ELECTRIC_PIANOS, ...SYNTH_INSTRUMENTS];
  const inputInstrument: InstrumentId = creationMode === "drums" ? "drumKit"
    : creationMode === "guitarTab" ? isGuitarInstrument(instrument) ? instrument : "acousticGuitar"
    : creationMode === "orchestra" ? ORCHESTRA_GROUPS.some((group) => (group.instruments as readonly InstrumentId[]).includes(instrument)) ? instrument : ORCHESTRA_GROUPS[0].instruments[0]
    : pianoSounds.includes(instrument) ? instrument : "piano";
  const guitar = creationMode === "guitarTab" && isGuitarInstrument(inputInstrument) ? inputInstrument : null;
  const drums = creationMode === "drums";
  const { playNote, sustain, setSustain } = usePianoSound(inputInstrument);
  const tabInstrument: GuitarInstrumentId = guitar ?? "acousticGuitar";
  const [activePartId, setActivePartId] = useState(MAIN_PART_ID);
  const [templateOpen, setTemplateOpen] = useState(false);
  const [playing, setPlaying] = useState(false);
  const playback = useRef<Playback | null>(null);
  const playbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const playbackPending = useRef<(() => void) | null>(null);
  const [active, setActive] = useState(69);
  const [pressed, setPressed] = useState<Set<number>>(new Set());

  const [phase, setPhase] = useState<KeysScorePhase>("idle");
  const showScore = keysShowsScore(phase);
  const canAppend = keysCanAppend(phase);
  const [notes, setNotes] = useState<NoteEvent[]>([]);
  const [bpm, setBpm] = useState(90);
  const [meter, setMeter] = useState<Meter>("4/4");
  const beats = beatsPerMeasureOf(meter);
  const [tonic, setTonic] = useState(0);
  const [mode, setMode] = useState<"major" | "minor">("major");
  const [progressionId, setProgressionId] = useState(AUTO_PROGRESSION);
  const [customChords, setCustomChords] = useState<ChordEvent[] | undefined>();
  const [accompaniment, setAccompaniment] = useState<AccompanimentSettings>({ mode: "block", pattern: "ascending" });
  const [chordEditorOpen, setChordEditorOpen] = useState(false);
  const [dur, setDur] = useState(1);
  const [loaded, setLoaded] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [titleOpen, setTitleOpen] = useState(false);
  const [composerOpen, setComposerOpen] = useState(false);
  const [selectedNote, setSelectedNote] = useState<number | null>(null);
  const [selectedChordBeat, setSelectedChordBeat] = useState<number | undefined>();
  const [noteChordOpen, setNoteChordOpen] = useState(false);
  const [defaultTitle, setDefaultTitle] = useState("");
  const [base, setBase] = useState(() => createBlankScore());

  // 초안 복원 / 저장 (음표 숫자만, 오디오 아님)
  useEffect(() => {
    const t = setTimeout(() => {
      const d = loadDraft();
      if (d && (d.notes.length > 0 || d.parts?.some((part) => part.notes.length))) {
        const saved = d.scoreId ? getScore(d.scoreId) : undefined;
        const restored = { ...(saved ?? createBlankScore()), ...d, chords: d.chords ?? [], id: saved?.id ?? d.scoreId ?? createBlankScore().id };
        const partId = d.activePartId ?? MAIN_PART_ID;
        const activeScore = scoreForPart(restored, partId);
        setBase(restored); setActivePartId(partId);
        setNotes(activeScore.notes);
        setBpm(d.bpm || 90); setMeter(d.meter);
        setTonic(d.key.tonic); setMode(d.key.mode);
        setProgressionId(d.progressionId);
        setCustomChords(partId === MAIN_PART_ID ? d.chords : activeScore.chords);
        setAccompaniment(activeScore.accompaniment ?? { mode: "block", pattern: "ascending" });
        setCreationMode(activeScore.notation ?? "piano");
        setInstrument(activeScore.instrument ?? "piano");
        // 복원한 악보는 마침줄과 함께 보여 주고, 편집 버튼으로 입력을 재개한다.
        setPhase("done");
      } else {
        // 초안이 없으면 설정의 새 악보 기본 템포·박자 (BPM 입력 범위 30~240 안)
        const p = loadScoreDefaults();
        setBpm(p.bpm);
        setMeter(p.meter);
      }
      if (new URLSearchParams(window.location.search).get("entry") === "1") setPhase("input");
      setLoaded(true);
    }, 0);
    return () => clearTimeout(t);
  }, [setInstrument]);

  // 조는 사용자가 고른 값 그대로 (음을 눌러도 조표가 바뀌지 않음)
  const draftScore = useMemo(() => {
    const key: KeyInfo = { tonic, mode, fifths: fifthsFor(tonic, mode) };
    const score = { ...scoreForPart(base, activePartId), notes, bpm, meter, beatsPerMeasure: beats, key, notation: creationMode, instrument: inputInstrument, accompaniment, transpose: drums ? 0 : base.transpose };
    const measures = scoreMeasureCount(score);
    const chords = drums ? [] : customChords ?? (progressionId === AUTO_PROGRESSION
      ? suggestChords(notes, key, beats, measures)
      : buildProgression(progressionId, key, measures, beats));
    return { ...score, chords };
  }, [base, activePartId, notes, bpm, meter, beats, tonic, mode, progressionId, customChords, creationMode, inputInstrument, drums, accompaniment]);
  const rootDraft = useMemo(() => updateScorePart(base, activePartId, {
    notes: draftScore.notes, chords: draftScore.chords, notation: creationMode, instrument: inputInstrument, accompaniment,
    bpm, meter, beatsPerMeasure: beats, key: draftScore.key,
  }), [base, activePartId, draftScore, creationMode, inputInstrument, accompaniment, bpm, meter, beats]);
  const hasNotes = getScoreParts(rootDraft).some((part) => part.notes.length > 0);
  useEffect(() => {
    if (!loaded) return;
    try {
      if (!hasNotes) localStorage.removeItem(DRAFT_KEY);
      else localStorage.setItem(DRAFT_KEY, serializeKeysDraft({
        notes: rootDraft.notes, bpm, meter, key: rootDraft.key, progressionId,
        chords: rootDraft.chords, scoreId: rootDraft.id, notation: rootDraft.notation, instrument: rootDraft.instrument,
        accompaniment: rootDraft.accompaniment, parts: rootDraft.parts, activePartId, title: rootDraft.title,
      }));
    } catch { /* storage unavailable */ }
  }, [loaded, hasNotes, rootDraft, bpm, meter, progressionId, activePartId]);
  const xml = useMemo(
    () => (showScore ? scoreToMusicXML(draftScore, accompaniment.mode === "arpeggio" ? "piano" : "lead", { minMeasures: drums ? 1 : keysPreviewMinMeasures(phase), measuresPerSystem: 4 }) : ""),
    [showScore, phase, draftScore, drums, accompaniment.mode],
  );

  // PC 키보드/건반 핸들러가 최신 상태를 보도록 ref 사용
  const handler = useRef<(midi: number) => void>(() => {});
  useEffect(() => {
    handler.current = (midi: number) => {
      setActive(midi);
      playNote(midi);
      if (!drums && canAppend && !titleOpen && !composerOpen && !noteChordOpen) setNotes((n) => appendNote(n, midi, dur));
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
      if (t && (t.tagName === "INPUT" || t.tagName === "SELECT" || t.tagName === "TEXTAREA" || t.closest('[role="dialog"]'))) return;
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

  function stopPlayback() {
    playbackPending.current?.(); playbackPending.current = null;
    playback.current?.stop(); playback.current = null;
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
    setPlaying(false);
  }
  useEffect(() => () => {
    playbackPending.current?.();
    playback.current?.stop();
    if (playbackTimer.current) clearTimeout(playbackTimer.current);
  }, []);
  function togglePlayback() {
    if (playing) { stopPlayback(); return; }
    setAudioSessionType("playback");
    const ctx = getAudioContext();
    setPlaying(true);
    const start = () => {
      playback.current = playScore(ctx, rootDraft);
      playbackTimer.current = setTimeout(stopPlayback, (playback.current.durationSec + 0.5) * 1000);
    };
    if (ctx.state === "running") { start(); return; }
    const ready = () => {
      if (ctx.state === "running") { ctx.removeEventListener("statechange", ready); playbackPending.current = null; start(); }
    };
    ctx.addEventListener("statechange", ready);
    playbackPending.current = () => ctx.removeEventListener("statechange", ready);
  }

  function selectPart(partId: string, whole = rootDraft) {
    stopPlayback();
    const selected = scoreForPart(whole, partId);
    setBase(whole); setActivePartId(partId);
    setNotes(selected.notes); setCustomChords(selected.chords);
    setCreationMode(selected.notation ?? "piano"); setInstrument(selected.instrument ?? "piano");
    setAccompaniment(selected.accompaniment ?? { mode: "block", pattern: "ascending" });
    setSelectedNote(null); setSelectedChordBeat(undefined); setNoteChordOpen(false);
    setPhase("input");
  }
  function selectInstrument(nextMode: CreationMode, nextInstrument: InstrumentId) {
    if (!hasNotes && !rootDraft.parts?.length) {
      selectPart(MAIN_PART_ID, { ...rootDraft, notation: nextMode, instrument: nextInstrument, chords: [] });
      return;
    }
    const result = addScorePart(rootDraft, nextMode, nextInstrument);
    selectPart(result.partId, result.score);
  }
  function changeMode(next: CreationMode) {
    if (next === creationMode) return;
    selectInstrument(next, next === "drums" ? "drumKit" : next === "guitarTab" ? "acousticGuitar" : next === "orchestra" ? ORCHESTRA_GROUPS[0].instruments[0] : "piano");
  }

  function openTitleDialog() {
    if (!hasNotes) return;
    setPhase("done");
    setDefaultTitle(rootDraft.title);
    setTitleOpen(true);
  }

  async function save(result: { title: string; composer?: string; lyricist?: string; arranger?: string }) {
    if (!hasNotes) return;
    const saved = await saveScore({ ...rootDraft, ...result });
    try { localStorage.removeItem(DRAFT_KEY); } catch { /* 무시 */ }
    setTitleOpen(false); // 이동 전에 닫아 대화상자가 DOM 에 남지 않게 함
    router.push(`/scores/${saved.id}`);
  }

  function openComposer() {
    setPhase("done");
    setComposerOpen(true);
  }

  const btn = "h-11 rounded-full px-4 text-sm lg:h-9";

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-medium">{drums ? "드럼으로 악보생성" : creationMode === "guitarTab" ? "기타TAB로 악보생성" : creationMode === "orchestra" ? "오케스트라로 악보생성" : "피아노로 악보생성"}</h1>
        </div>
        <div className="flex w-full min-w-0 max-w-full flex-wrap items-center justify-end gap-2 sm:w-auto">
        <Button type="button" variant="outline" onClick={() => setTemplateOpen(true)} className="h-11 rounded-full px-4 text-sm lg:h-9">템플릿으로 시작하기</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => setPhase(keysToggleInput)}
          aria-pressed={phase === "input"}
          className={`h-11 rounded-full px-4 text-sm lg:h-9 ${phase === "input" ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
        >
          악보생성
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={notes.length === 0}
          onClick={() => { setPhase("edit"); if (!drums) setChordEditorOpen(true); }}
          title="음표를 이어서 입력하고 마디별 코드를 수정해요"
          aria-pressed={phase === "edit"}
          className={`h-11 rounded-full px-4 text-sm lg:h-9 ${phase === "edit" ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
        >
          악보 편집
        </Button>
        <Button type="button" variant="outline" disabled={!loaded || drums} onClick={openComposer} title={drums ? "드럼은 아래 리듬 격자에서 직접 입력하세요" : "현재 악보로 작곡 도구 열기"} className="h-11 rounded-full px-4 text-sm lg:h-9">
          작곡하기
        </Button>
        </div>
      </header>

      <Card className="gap-3 p-4">
        <CreationInstrumentSelector mode={creationMode} instrument={inputInstrument} onModeChange={changeMode} onInstrumentChange={(next) => selectInstrument(creationMode, next)} />
        {drums && <p className="text-xs text-ink-soft">드럼은 아래 격자에서 악기별 타격을 입력합니다. 멜로디 작곡과 코드 수정은 피아노·기타TAB·오케스트라에서 사용할 수 있어요.</p>}
      </Card>

      <ScorePartsPanel score={rootDraft} activePartId={activePartId} onSelect={(partId) => selectPart(partId)} onAdd={selectInstrument} />

      {!drums && <MidiConnectButton
        status={midi.supported ? midi.status : "unsupported"}
        devices={midi.devices}
        message={midi.message}
        onConnect={connectMidiKeyboard}
      />}

      {/* 입력 도구 */}
      {canAppend && !drums && (
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
            {phase === "edit"
              ? "건반을 누르면 마지막 음 뒤에 추가돼요. 마디가 차면 다음 마디가 자동으로 늘어나요. BPM 아래 코드수정하기에서 마디별 코드도 바꿀 수 있어요."
              : notes.length === 0
              ? "먼저 조를 고른 뒤 건반을 눌러 입력하세요. 음 길이를 고르면 악보에 추가돼요."
              : "음 길이를 고르고 건반을 누르면 악보에 추가돼요. 조를 바꿔도 음높이는 그대로예요."}
          </p>
          <DurationPicker value={dur} onChange={setDur} />
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <Button type="button" variant="outline" className={btn} onClick={() => setNotes((n) => appendNote(n, null, dur))}>쉼표 추가</Button>
            <Button type="button" variant="outline" className={btn} disabled={notes.length === 0} onClick={() => setNotes((n) => deleteNote(n, n.length - 1))}>되돌리기</Button>
            <Button type="button" variant="outline" className={btn} onClick={() => setPhase("done")}>
              {phase === "edit" ? "편집 마치기" : "입력 마치기"}
            </Button>
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
                onClick={() => {
                  const nextBeats = beatsPerMeasureOf(m.id);
                  // 마디별로 고친 코드는 박자 변경 뒤에도 같은 마디·상대 위치에 둔다.
                  setCustomChords((chords) => chords?.map((chord) => ({ ...chord, startBeat: chord.startBeat / beats * nextBeats })));
                  setMeter(m.id);
                }}
                aria-pressed={meter === m.id}
                className={`h-11 rounded-full px-4 lg:h-9 ${meter === m.id ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
              >
                {m.label}
              </Button>
            ))}
            <span className="text-ink-soft">{notes.length}개 음표</span>
          </div>
          <section className="grid min-w-0 gap-3" aria-label="코드수정하기">
            <Button
              type="button"
              variant="outline"
              className={`${btn} justify-self-start`}
              aria-expanded={chordEditorOpen}
              aria-controls="keys-chord-editor"
              onClick={() => setChordEditorOpen((open) => !open)}
            >
              코드수정하기
            </Button>
            {chordEditorOpen && (
              <div id="keys-chord-editor" className="min-w-0">
                <ChordEditor key={`${base.id}:${activePartId}`} score={draftScore} onChange={setCustomChords} />
                <p className="mt-2 text-xs text-ink-soft">수정한 코드는 악보 미리보기와 저장에 반영돼요. 아래 코드 진행을 다시 선택하면 해당 진행으로 바뀌어요.</p>
              </div>
            )}
          </section>
          <label className="flex flex-wrap items-center gap-2 text-sm">
            코드 진행
            <select
              aria-label="코드 진행"
              value={progressionId}
              onChange={(e) => { setProgressionId(e.target.value); setCustomChords(undefined); }}
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

      {drums && <>
        <Card className="gap-3 p-4">
          <div className="flex flex-wrap items-center gap-3 text-sm">
            <label className="flex items-center gap-2">BPM<Input type="number" min={30} max={240} value={bpm} onChange={(event) => setBpm(Math.min(240, Math.max(30, Number(event.target.value) || 90)))} className="h-11 w-20" /></label>
            {METERS.map((entry) => <Button key={entry.id} type="button" variant="outline" aria-pressed={meter === entry.id} className={btn} onClick={() => { stopPlayback(); setMeter(entry.id); }}>{entry.label}</Button>)}
            <Button type="button" onClick={togglePlayback} disabled={notes.length === 0} className={btn}>{playing ? "재생 중지" : "드럼 재생"}</Button>
            <Button type="button" variant="destructive" disabled={notes.length === 0} onClick={() => setConfirmClear(true)} className={btn}>전체 지우기</Button>
          </div>
        </Card>
        <DrumEditor key={base.id} score={draftScore} onPreview={playNote} onChange={(next) => { stopPlayback(); setNotes(next); setPhase("input"); }} />
      </>}

      <ConfirmDialog
        open={confirmClear}
        onOpenChange={setConfirmClear}
        title="음표를 모두 지울까요?"
        description="작성 중인 음표가 모두 사라져요."
        confirmLabel="모두 지우기"
        onConfirm={() => { setNotes([]); setCustomChords(undefined); }}
      />

      {/* 선택한 악기의 입력 화면 */}
      {!drums && (guitar
        ? <GuitarFretboard instrument={guitar} active={active} onPress={(m) => handler.current(m)} />
        : <PianoKeyboard active={active} pressed={pressed} onPress={(m) => handler.current(m)} />)}

      {/* 악보 미리보기 (건반 바로 아래) */}
      {showScore && <>
        <ScoreView xml={xml} chordEditor={phase === "edit" && !drums ? {
          chords: draftScore.chords,
          onSelect: (startBeat) => {
            setSelectedChordBeat(startBeat);
            setSelectedNote(notes.findIndex((note) => Math.abs(note.startBeat - startBeat) < 1e-6));
            setNoteChordOpen(true);
          },
        } : undefined} cursor={phase === "edit" && !drums ? {
          notes, beatsPerMeasure: beats, selected: selectedNote,
          onSelect: (index) => { setSelectedNote(index); setSelectedChordBeat(undefined); setNoteChordOpen(true); },
          announce: selectedNote === null ? "음표를 눌러 코드를 수정하세요" : `${selectedNote + 1}번째 음표 코드 수정`,
          toolbarOpen: false,
          onDismiss: () => setSelectedNote(null),
          dragLabel: () => null,
          onDragPreview: () => {},
          onDragCommit: () => {},
        } : undefined} />
        {creationMode === "guitarTab" && <TabScoreView score={draftScore} instrument={tabInstrument} minMeasures={keysPreviewMinMeasures(phase)} />}
      </>}
      {showScore && getScoreParts(rootDraft).filter((part) => part.id !== activePartId).map((part) => <section key={part.id} aria-label={`${INSTRUMENT_LABELS[part.instrument]} 악보`} className="grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold">{INSTRUMENT_LABELS[part.instrument]} 악보</h2>
        <ScoreView xml={scoreToMusicXML(scoreForPart(rootDraft, part.id), part.notation === "piano" && part.accompaniment?.mode === "arpeggio" ? "piano" : "lead")} />
      </section>)}
      {phase === "done" && !drums && (
        <p role="status" className="text-sm text-ink-soft">
          입력을 마쳤어요. 남은 빈 마디를 정리하고 마지막 마디에 마침줄을 넣었어요. 악보 편집을 누르면 이어서 입력하고 코드도 수정할 수 있어요.
        </p>
      )}

      {/* 오선지 + 정보 카드 */}
      {creationMode === "piano" && <AccompanimentSettingsPanel value={accompaniment} onChange={(next) => { stopPlayback(); setAccompaniment(next); }} />}
      {!drums && <Card className="flex-row items-center gap-4 p-4">
        <NoteStaff midi={active} forceBass={guitar === "bassGuitar" || guitar === "bassGuitar5"} />
        <div className="flex min-w-0 flex-col gap-1">
          <p className="text-4xl font-bold tabular-nums">{key.name}</p>
          <p className="tabular-nums text-sm text-ink-soft">{key.freq.toFixed(2)} Hz</p>
          <p className="tabular-nums text-sm text-ink-soft">MIDI {key.midi} · {key.keyNumber}/88</p>
        </div>
      </Card>}

      {!drums && <label className={`flex min-h-11 items-center gap-2 text-sm ${creationMode === "piano" ? "" : "opacity-50"}`}>
        <input
          type="checkbox"
          checked={sustain}
          disabled={creationMode !== "piano"}
          onChange={(e) => setSustain(e.target.checked)}
          className="h-5 w-5 accent-accent"
        />
        서스테인 페달 (감쇠 2.5배){creationMode !== "piano" && " · 피아노에서만 사용"}
      </label>}

      {showScore && (
        <Button type="button" disabled={!hasNotes} onClick={openTitleDialog} className="h-11 w-full text-sm">
          악보로 저장
        </Button>
      )}
      <TitleDialog
        open={titleOpen}
        defaultTitle={defaultTitle}
        onConfirm={save}
        onCancel={() => setTitleOpen(false)}
      />

      {composerOpen && <CompositionDialog
        score={notes.length ? draftScore : { ...draftScore, chords: [] }}
        instrument={inputInstrument}
        mode="compose"
        onClose={() => setComposerOpen(false)}
        onApply={async (patch) => {
          const saved = await saveScore(updateScorePart(rootDraft, activePartId, patch));
          if (getScore(saved.id)?.updatedAt !== saved.updatedAt) throw new Error("악보를 저장하지 못했어요. 기기 저장 공간을 확인한 뒤 다시 시도해 주세요.");
          setBase(saved);
          if (patch.notes) setNotes(patch.notes);
          if (patch.chords) setCustomChords(patch.chords);
          setPhase("done");
        }}
      />}
      <Dialog open={noteChordOpen} onOpenChange={setNoteChordOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>음표 코드 변경</DialogTitle>
            <DialogDescription>선택한 음표의 코드를 바꾸고 적용하세요.</DialogDescription>
          </DialogHeader>
          <NoteChordEditor score={draftScore} selected={selectedNote !== null && selectedNote >= 0 ? selectedNote : null} startBeat={selectedChordBeat} onChange={setCustomChords} />
        </DialogContent>
      </Dialog>

      {templateOpen && <ScoreTemplateDialog replacing={hasNotes} onClose={() => setTemplateOpen(false)} onCreate={(created) => {
        selectPart(MAIN_PART_ID, created); setBpm(created.bpm); setMeter(created.meter ?? "4/4");
        setTonic(created.key.tonic); setMode(created.key.mode); setPhase("done"); setTemplateOpen(false);
      }} />}


      {!drums && <details className="rounded-2xl border border-line bg-surface p-4 text-sm">
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
      </details>}
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
