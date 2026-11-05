"use client";
import Link from "next/link";
import { ScorePartsPanel } from "@/components/score-parts-panel";
import { MAIN_PART_ID, getScoreParts, scoreForPart, updateScorePart, addScorePart } from "@/lib/music/parts";
import { canTie } from "@/lib/music/articulation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Download, FileMusic, Play, Printer, Share2, Square, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { AudioImportDialog } from "@/components/audio-import-dialog";
import { AccompanimentSettingsPanel } from "@/components/accompaniment-settings";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { LyricsDialog } from "@/components/lyrics-dialog";
import { CompositionDialog, type CompositionMode } from "@/components/composition-dialog";
import { NoteChordEditor } from "@/components/note-chord-editor";
import { DrumEditor } from "@/components/drum-editor";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { TabScoreView } from "@/components/tab-score-view";
import { ChordEditor } from "@/components/chord-editor";
import { NoteEditor } from "@/components/note-editor";
import { ScoreView, type ScoreViewHandle } from "@/components/score-view";
import { TransposeBar } from "@/components/transpose-bar";
import { InlineField } from "@/components/inline-field";
import { ScoreEditToolbar } from "@/components/score-edit-toolbar";
import { applyEditKey, describeInterval, describeNote, dragTargetMidi } from "@/components/score-cursor";
import { ScoreHeader, HeaderSettings } from "@/components/score-header";
import { formatCredits } from "@/components/score-header-logic";
import { usePianoSound } from "@/hooks/use-piano-sound";
import { useInstrument } from "@/hooks/use-instrument";
import { useScoreEditKeys } from "@/hooks/use-score-edit-keys";
import { useScore } from "@/hooks/use-score-param";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import { playScore, type Playback } from "@/lib/audio/piano-synth";
import { INSTRUMENT_LABELS, INSTRUMENT_ORDER, isInstrumentId } from "@/lib/audio/instruments";
import { scoreToMidi } from "@/lib/music/midi";
import { meterOf, timeSignatureOf } from "@/lib/music/meter";
import { scoreToMusicXML, type ScoreLayout } from "@/lib/music/musicxml";
import { measureOf, removeDynamic, setDynamic, toggleMeasureMark, updateNote } from "@/lib/music/edit";
import { midiToName } from "@/lib/music/frequency";
import { keyName, transposeKey } from "@/lib/music/theory";
import { exportFile, isNativeApp, safeFileName } from "@/lib/platform/export-file";
import { sheetToPdf } from "@/lib/platform/sheet-pdf";
import { deleteScore, getScore, saveScore, subscribeScores, getScoreSessionVersion } from "@/lib/storage/scores";
import type { Score } from "@/lib/music/types";
import { isGuitarInstrument, type GuitarInstrumentId } from "@/lib/music/tablature";

const compositionSignature = (score: Score) => JSON.stringify([score.notes, score.chords, score.marks, score.dynamics]);

interface ScoreEntry { edit: boolean; compose: boolean; importAudio: boolean }

export function ScoreClient({ id, entry }: { id: string; entry?: ScoreEntry }) {
  const session = useSyncExternalStore(subscribeScores, getScoreSessionVersion, () => 0);
  return <ScoreEditor key={`${id}:${session}:${entry?.edit}:${entry?.compose}:${entry?.importAudio}`} id={id} entry={entry} />;
}

function ScoreEditor({ id, entry }: { id: string; entry?: ScoreEntry }) {
  const router = useRouter();
  const { score: storedScore, update: persist } = useScore(id);
  const [draftRoot, setDraftRoot] = useState<Score | null>(null);
  const draftRef = useRef<Score | null>(null);
  const [activePartId, setActivePartId] = useState(MAIN_PART_ID);
  const rootScore = storedScore === null ? null : draftRoot ?? storedScore;
  const [editingSession] = useState(getScoreSessionVersion);
  const score = rootScore ? scoreForPart(rootScore, activePartId) : rootScore;
  const [saving, setSaving] = useState(false);
  const [compositionMode, setCompositionMode] = useState<CompositionMode | null>(entry?.compose ? "compose" : null);
  const [compositionUndo, setCompositionUndo] = useState<{ patch: Partial<Score>; expected: string } | null>(null);
  function update(patch: Partial<Score>) {
    if (editingSession !== getScoreSessionVersion() || !getScore(id)) return;
    setCompositionUndo(null);
    const current = draftRef.current ?? rootScore;
    if (!current) return;
    const next = updateScorePart(current, activePartId, patch);
    if (editMode) { draftRef.current = next; setDraftRoot(next); }
    else persist(next);
  }
  const [selectedLayout, setLayout] = useState<ScoreLayout | null>(null);
  const layout: ScoreLayout = selectedLayout ?? (score?.accompaniment?.mode === "arpeggio" ? "piano" : "lead");
  const [showTab, setShowTab] = useState(false);
  const [chordEditingBeat, setChordEditingBeat] = useState<number | null>(null);
  const [preferredInstrument, setPreferredInstrument] = useInstrument();
  const isDrums = score?.notation === "drums" || score?.instrument === "drumKit";
  const instrument = isDrums ? "drumKit" : score?.instrument ?? preferredInstrument;
  function setInstrument(value: typeof preferredInstrument) {
    setPreferredInstrument(value);
    update({ instrument: value });
  }
  const [editNotes, setEditNotes] = useState(false);
  const [editMode, setEditMode] = useState(entry?.edit ?? false);
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const sound = usePianoSound(instrument);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(entry?.importAudio ?? false);
  // '내 악보 → 음원 파일'로 들어오면(?import=audio) 음원 등록 창을 바로 연다. 적용 없이 닫으면 빈 악보는 지운다
  const fromImport = useRef(entry?.importAudio ?? false);
  useEffect(() => {
    if (entry?.edit || entry?.compose || entry?.importAudio) window.history.replaceState(null, "", window.location.pathname);
  }, [entry]);
  const viewHandle = useRef<ScoreViewHandle | null>(null);
  const exportHandle = useRef<ScoreViewHandle | null>(null);
  const playback = useRef<Playback | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCleanup = useRef<(() => void) | null>(null);

  /** 재생·타이머·대기 중 리스너를 모두 정리 */
  const clearPlayback = useCallback(() => {
    pendingCleanup.current?.();
    pendingCleanup.current = null;
    playback.current?.stop();
    playback.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  useEffect(() => clearPlayback, [clearPlayback]);

  function resetSelection() {
    clearPlayback(); setPlaying(false); setSelected(null); setToolbarOpen(false); setChordEditingBeat(null);
    setLyricsOpen(false); setAudioOpen(false);
  }
  function enterEdit() {
    if (editMode || !rootScore) return;
    draftRef.current = rootScore; setDraftRoot(rootScore); setEditMode(true); resetSelection();
  }
  async function applyEdits(exit = false) {
    if (editingSession !== getScoreSessionVersion() || !getScore(id)) {
      toast.error("계정이나 악보 상태가 바뀌었어요. 악보를 다시 열어 주세요.");
      return;
    }
    const current = draftRef.current ?? rootScore;
    if (!current || saving) return;
    setSaving(true); clearPlayback(); setPlaying(false);
    try {
      const saved = await saveScore(current);
      if (getScore(saved.id)?.updatedAt !== saved.updatedAt) throw new Error("기기 저장 공간을 확인하고 다시 시도해 주세요.");
      draftRef.current = saved; setDraftRoot(saved);
      if (exit) { setEditMode(false); setEditNotes(false); resetSelection(); draftRef.current = null; setDraftRoot(null); }
      toast.success(exit ? "악보를 저장했어요" : "변경을 적용했어요. 계속 편집할 수 있어요");
    } catch (error) { toast.error(error instanceof Error ? error.message : "악보를 저장하지 못했어요"); }
    finally { setSaving(false); }
  }
  const xml = useMemo(() => (score ? scoreToMusicXML(score, layout, { externalHeader: true }) : ""), [score, layout]);

  const noteCount = score?.notes.length ?? 0;
  const selected = selectedRaw !== null && selectedRaw < noteCount ? selectedRaw : null;

  useScoreEditKeys({
    enabled: editMode && !isDrums && editNotes && !lyricsOpen && !audioOpen && compositionMode === null,
    notes: score?.notes ?? [],
    selected,
    transpose: score?.transpose ?? 0,
    setSelected,
    onChange: (notes) => update({ notes }),
    playNote: sound.playNote,
    onEscape: toolbarOpen ? () => setToolbarOpen(false) : undefined,
  });

  if (score === undefined) return <p className="text-ink-soft" role="status">불러오는 중…</p>;
  if (score === null)
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">악보를 찾을 수 없어요.</p>
        <Button asChild variant="outline" className="mt-4 h-11 px-5"><Link href="/library">내 악보로</Link></Button>
      </div>
    );

  const shownKey = transposeKey(score.key, score.transpose);
  const tabInstrument: GuitarInstrumentId = isGuitarInstrument(instrument) ? instrument : "acousticGuitar";

  function togglePlay() {
    if (playing) {
      clearPlayback();
      setPlaying(false);
      return;
    }
    clearPlayback(); // 기존 재생·타이머·리스너 정리 후 시작
    setAudioSessionType("playback");
    const ctx = getAudioContext(); // 제스처 핸들러 안에서 동기 호출 (await 금지)
    const target = rootScore!;
    const doPlay = () => {
      playback.current = playScore(ctx, target, { instrument: activePartId === MAIN_PART_ID ? instrument : target.instrument });
      stopTimer.current = setTimeout(() => setPlaying(false), (playback.current.durationSec + 2.5) * 1000);
    };
    setPlaying(true);
    if (ctx.state === "running") {
      doPlay();
    } else {
      let giveUp: ReturnType<typeof setTimeout> | null = null;
      const release = () => {
        ctx.removeEventListener("statechange", h);
        if (giveUp) clearTimeout(giveUp);
        pendingCleanup.current = null;
      };
      function h() {
        if (ctx.state === "running") {
          release();
          doPlay();
        }
      }
      ctx.addEventListener("statechange", h);
      giveUp = setTimeout(() => {
        release();
        setPlaying(false);
      }, 3000);
      pendingCleanup.current = release;
    }
  }

  const announce =
    editNotes && selected !== null
      ? describeNote(score.notes, selected, score.transpose, shownKey.fifths < 0)
      : "";

  const flats = shownKey.fifths < 0;
  const curNote = selected !== null ? score.notes[selected] : null;
  const curMeasure = curNote ? measureOf(curNote.startBeat, score.beatsPerMeasure) : 0;
  const dynamicHere = curNote ? (score.dynamics ?? []).find((d) => Math.abs(d.startBeat - curNote.startBeat) < 1e-6) : undefined;

  /** 도구 모음 버튼도 키보드와 같은 편집 함수(applyEditKey)를 사용 */
  function runKey(key: string) {
    if (selected === null) return;
    const r = applyEditKey(score!.notes, selected, key);
    if (!r) return;
    if (r.notes) update({ notes: r.notes });
    setSelected(r.sel);
    if (r.sel === null) setToolbarOpen(false);
    if (r.play !== undefined) sound.playNote(r.play + score!.transpose, { duration: 0.4 }); // 버튼 탭 = 사용자 제스처
  }

  const dragLabel = (steps: number): string | null =>
    curNote?.midi == null ? null : midiToName(dragTargetMidi(curNote.midi, steps) + score.transpose, flats);
  const dragPreview = (steps: number) => {
    if (curNote?.midi == null) return;
    sound.playNote(dragTargetMidi(curNote.midi, steps) + score.transpose, { duration: 0.3 });
  };
  const dragCommit = (steps: number) => {
    if (selected === null || curNote?.midi == null) return;
    update({ notes: updateNote(score.notes, selected, { midi: dragTargetMidi(curNote.midi, steps) }) });
  };

  const ts = timeSignatureOf(score);
  const meterLabel = meterOf(score) ?? `${ts.beats}/${ts.beatType}`;
  const header = <ScoreHeader score={rootScore!} />;
  const base = `${safeFileName(score.title)}_${keyName(shownKey)}`;

  // 웹은 브라우저 인쇄, 앱은 이미지 PDF를 만들어 공유 시트로
  const printOrPdf = async () => {
    const view = exportHandle.current ?? viewHandle.current;
    if (!view || pdfBusy) return;
    setPdfBusy(true);
    const credits = formatCredits(score);
    const t = toast.loading("PDF를 만드는 중…");
    try {
      const deadline = Date.now() + 15_000;
      while (view.container.getAttribute("aria-busy") === "true" && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
      if (view.container.getAttribute("aria-busy") === "true") throw new Error("악보를 그리는 중이에요. 잠시 후 다시 시도해 주세요.");
      if (!isNativeApp()) { window.print(); return; }
      // 음표 선택 표시는 SVG 밖(HTML)이라 PDF에 들어가지 않는다. OSMD가 제목을 이미 그렸다면 직접 머리글은 생략
      const bytes = await sheetToPdf(view.container, view.drawsTitle ? [] : [score.title, credits], view.systemSpans());
      await exportFile(`${base}.pdf`, bytes, "application/pdf");
    } catch (e) {
      const msg = e instanceof Error ? e.message : "";
      if (!/cancel/i.test(msg)) toast.error(msg || "PDF를 만들지 못했어요"); // 공유 시트 취소는 오류가 아님
    } finally {
      toast.dismiss(t);
      setPdfBusy(false);
    }
  };

  return (
    <div className="score-editor-page flex flex-col gap-4">
      <div className="no-print flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          {editMode ? <InlineField
            label="제목"
            ariaLabel="악보 제목"
            value={score.title}
            onCommit={(t) => {
              update({ title: t });
              toast.success("제목을 저장했어요");
            }}
            className="[&_input]:text-xl [&_input]:font-medium"
          /> : <h1 className="text-xl font-medium break-words">{score.title}</h1>}
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0 rounded-full px-4 text-sm">
          <Link href={`/scores/${score.id}/perform`}>공연 모드</Link>
        </Button>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        {!isDrums && (["lead", "piano"] as const).filter((l) => l === "lead" || score.notation === "piano").map((l) => (
          <Button
            key={l}
            type="button"
            variant="outline"
            onClick={() => { setLayout(l); setShowTab(false); }}
            aria-pressed={layout === l && !showTab}
            className={`h-11 rounded-full px-4 lg:h-9 ${layout === l && !showTab ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
          >
            {l === "lead" ? "코드 악보" : "피아노"}
          </Button>
        ))}
        {!isDrums && <Button type="button" variant="outline" aria-pressed={showTab} onClick={() => setShowTab(true)} className={`h-11 rounded-full px-4 lg:h-9 ${showTab ? "border-accent bg-accent/15 text-accent" : ""}`}>TAB</Button>}
        {!isDrums && showTab && <label className="flex min-w-0 items-center gap-2">TAB 악기
          <select aria-label="TAB 악기" value={tabInstrument} onChange={(event) => { if (isGuitarInstrument(event.target.value)) setInstrument(event.target.value); }} className="h-11 min-w-0 rounded-md border border-input bg-surface px-3 text-sm">
            {(["classicalGuitar", "acousticGuitar", "electricGuitar", "bassGuitar", "bassGuitar5"] as const).map((id) => <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>)}
          </select>
        </label>}
        <span className="ml-auto text-ink-soft">
          {score.bpm} BPM · <span className="text-xs">{meterLabel}</span>
        </span>
      </div>
      {score.notation === "piano" && <AccompanimentSettingsPanel value={score.accompaniment} onChange={(accompaniment) => {
        clearPlayback(); setPlaying(false); setLayout("piano"); setShowTab(false); update({ accompaniment });
      }} />}

      <ScorePartsPanel score={rootScore!} activePartId={activePartId} onSelect={(partId) => { resetSelection(); setActivePartId(partId); setShowTab(false); setLayout(null); }} onAdd={(notation, selectedInstrument) => {
        const result = addScorePart(draftRef.current ?? rootScore!, notation, selectedInstrument);
        draftRef.current = result.score; setDraftRoot(result.score); setActivePartId(result.partId);
        setEditMode(true); setEditNotes(true); resetSelection(); setShowTab(false); setLayout(null);
      }} />
      {editMode && <div role="group" aria-label="악보 편집 적용과 저장" className="no-print sticky top-0 z-20 flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface p-3">
        <p className="mr-auto text-sm text-ink-soft">{INSTRUMENT_LABELS[instrument]} 편집 중 · 저장하면 편집을 마칩니다.</p>
        <Button type="button" variant="outline" disabled={saving} onClick={() => void applyEdits()} className="h-11 px-5">적용</Button>
        <Button type="button" disabled={saving} onClick={() => void applyEdits(true)} className="h-11 px-5">저장</Button>
      </div>}
      <h2 className="text-sm font-semibold">{INSTRUMENT_LABELS[instrument]} 악보</h2>
      <ScoreView
        onHandle={(h) => {
          viewHandle.current = h;
        }}
        showHeader={false}
        header={header}
        xml={xml}
        chordEditor={editMode && !isDrums && editNotes ? { chords: score.chords, onSelect: (startBeat) => { setChordEditingBeat(startBeat); setToolbarOpen(false); } } : undefined}
        cursor={
          editMode && !isDrums && editNotes
            ? {
                notes: score.notes,
                beatsPerMeasure: score.beatsPerMeasure,
                selected,
                onSelect: (i) => {
                  setSelected(i);
                  setToolbarOpen(true);
                },
                announce,
                toolbarOpen,
                onDismiss: () => setToolbarOpen(false),
                dragLabel,
                onDragPreview: dragPreview,
                onDragCommit: dragCommit,
                toolbar: curNote ? (<>
                  <ScoreEditToolbar
                    noteLabel={curNote.midi === null ? "쉼표" : midiToName(curNote.midi + score.transpose, flats)}
                    interval={selected !== null ? describeInterval(score.notes, selected, score.transpose, shownKey) : null}
                    isRest={curNote.midi === null}
                    duration={curNote.durationBeats}
                    onPitch={(d) => runKey(d === 1 ? "ArrowUp" : "ArrowDown")}
                    onDuration={runKey}
                    onDot={() => runKey(".")}
                    onDuplicate={() => runKey("Enter")}
                    onDelete={() => runKey("Delete")}
                    onClose={() => setToolbarOpen(false)}
                    dynamic={dynamicHere?.kind ?? null}
                    onDynamic={(k) => {
                      const next = k === null ? removeDynamic(score, curNote.startBeat) : setDynamic(score, curNote.startBeat, k);
                      if (next === score) {
                        toast.error("크레셴도·디미누엔도 구간 안에는 다른 셈여림을 넣을 수 없어요"); // setDynamic 이 겹침을 거부하면 원본 그대로 반환
                        return;
                      }
                      update({ dynamics: next.dynamics }); // 비면 undefined 로 덮어써서 키를 지움
                    }}
                    measureNumber={curMeasure + 1}
                    activeMarks={(score.marks ?? []).filter((m) => m.measure === curMeasure).map((m) => m.kind)}
                    onToggleMark={(k) => update({ marks: toggleMeasureMark(score, curMeasure, k).marks })}
                  />
                  {curNote.midi !== null && <NoteChordEditor commitOnBlur score={score} selected={selected} onChange={(chords) => update({ chords })} />}
                </>) : null,
              }
            : undefined
        }
      />

      {getScoreParts(rootScore!).filter((part) => part.id !== activePartId).map((part) => <section key={part.id} aria-label={`${INSTRUMENT_LABELS[part.instrument]} 악보`} className="grid min-w-0 gap-2">
        <h2 className="text-sm font-semibold">{INSTRUMENT_LABELS[part.instrument]} 악보</h2>
        <ScoreView showHeader={false} xml={scoreToMusicXML(scoreForPart(rootScore!, part.id), part.notation === "piano" && part.accompaniment?.mode === "arpeggio" ? "piano" : "lead", { externalHeader: true })} />
      </section>)}
      {!isDrums && showTab && <TabScoreView score={score} instrument={tabInstrument} />}
      <Dialog open={chordEditingBeat !== null} onOpenChange={(open) => { if (!open) setChordEditingBeat(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>코드 변경</DialogTitle><DialogDescription>선택한 위치의 코드 근음과 종류를 고르고 적용해 주세요.</DialogDescription></DialogHeader>
          {chordEditingBeat !== null && <NoteChordEditor commitOnBlur score={score} selected={null} startBeat={chordEditingBeat} onChange={(chords) => update({ chords })} />}
        </DialogContent>
      </Dialog>

      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => { clearPlayback(); setPlaying(false); setCompositionMode("compose"); }} className="h-11 rounded-full px-4 text-sm lg:h-9">
          작곡
        </Button>
        <Button type="button" variant="outline" aria-pressed={editMode} aria-expanded={editMode} aria-controls="score-edit-mode-panel" onClick={() => {
          enterEdit();
        }} className={`h-11 rounded-full px-4 text-sm lg:h-9 ${editMode ? "border-accent bg-accent/15 text-accent" : ""}`}>
          편집모드
        </Button>
        {compositionUndo && <Button type="button" variant="outline" disabled={compositionSignature(score) !== compositionUndo.expected} onClick={() => {
          clearPlayback(); setPlaying(false);
          update(compositionUndo.patch); setCompositionUndo(null); setSelected(null);
          toast.success("작곡·리하모니 적용 전으로 되돌렸어요");
        }} className="h-11 rounded-full px-4 text-sm lg:h-9">작곡·리하모니 되돌리기</Button>}
      </div>
      {editMode && <section id="score-edit-mode-panel" aria-label="악보 편집 옵션" className="no-print grid gap-4 rounded-xl border border-line bg-surface p-4">
        <h2 className="text-sm font-semibold">악보 편집 옵션</h2>
        <div className="grid min-w-0 gap-2 md:grid-cols-3">
          {([['lyricist', '작사', score.lyricist], ['composer', '작곡', score.composer], ['arranger', '편곡', score.arranger]] as const).map(([field, label, value]) => <InlineField
            key={field} label={label} ariaLabel={`${label}자`} placeholder={`${label}자 (선택)`} allowEmpty value={value ?? ""}
            onCommit={(text) => { update({ [field]: text || undefined }); toast.success(`${label}자를 저장했어요`); }}
          />)}
        </div>
        <p className="text-xs text-ink-soft">작사·작곡·편곡은 입력한 항목만 악보에 표시합니다.</p>
        <HeaderSettings score={score} onChange={(patch) => update(patch)} />
        <div className="flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => { clearPlayback(); setPlaying(false); setCompositionMode("reharmonize"); }} className="h-11 rounded-full px-4 text-sm lg:h-9">고급 리하모니제이션</Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => { setEditNotes((value) => !value); setSelected(null); setToolbarOpen(false); setChordEditingBeat(null); }}
          aria-pressed={editNotes}
          className={`h-11 rounded-full px-4 text-sm lg:h-9 ${editNotes ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
        >
          음표 편집
        </Button>
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => setLyricsOpen(true)} className="h-11 rounded-full px-4 text-sm lg:h-9">
          <Type aria-hidden /> 가사 등록
        </Button>
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => setAudioOpen(true)} className="h-11 rounded-full px-4 text-sm lg:h-9">
          <AudioLines aria-hidden /> 음원 등록
        </Button>
        </div>
      </section>}
      {compositionMode !== null && <CompositionDialog
        key={compositionMode}
        score={score}
        mode={compositionMode}
        instrument={instrument}
        onClose={() => setCompositionMode(null)}
        onApply={async (patch) => {
          const before = { notes: score.notes, chords: score.chords, marks: score.marks, dynamics: score.dynamics };
          update(patch);
          if (!editMode) {
            const saved = await saveScore(updateScorePart(rootScore!, activePartId, patch));
            if (getScore(saved.id)?.updatedAt !== saved.updatedAt) throw new Error("악보를 저장하지 못했어요.");
          }
          setCompositionUndo({ patch: before, expected: compositionSignature({ ...score, ...patch }) });
          setSelected(null); setToolbarOpen(false);
        }}
      />}
      <LyricsDialog
        open={lyricsOpen}
        onOpenChange={setLyricsOpen}
        notes={score.notes}
        fromIndex={editNotes && selected !== null ? selected : 0}
        onApply={(notes) => update({ notes })}
      />
      <AudioImportDialog
        open={audioOpen}
        onOpenChange={(open) => {
          setAudioOpen(open);
          if (open || !fromImport.current) return;
          fromImport.current = false;
          if (score.notes.length === 0) {
            deleteScore(score.id);
            router.replace("/library");
          }
        }}
        score={score}
        onApply={(patch) => {
          fromImport.current = false;
          setSelected(null);
          update(patch);
        }}
      />
      {editMode && editNotes && !isDrums && (
        <>
          {selected !== null && <div role="group" aria-label="붙임줄과 이음줄" className="no-print flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled={!canTie(score.notes, selected)} aria-pressed={!!curNote?.tieToNext} onClick={() => update({ notes: score.notes.map((note, index) => index === selected ? { ...note, tieToNext: !note.tieToNext } : note) })} className="h-11 px-4">붙임줄</Button>
            <Button type="button" variant="outline" disabled={curNote?.midi == null || score.notes[selected + 1]?.midi == null} aria-pressed={!!curNote?.slurToNext} onClick={() => update({ notes: score.notes.map((note, index) => index === selected ? { ...note, slurToNext: !note.slurToNext } : note) })} className="h-11 px-4">이음줄</Button>
            <p className="self-center text-xs text-ink-soft">선택한 음과 다음 음을 연결합니다. 붙임줄은 연속한 같은 높이의 음에 사용해요.</p>
          </div>}
          <NoteEditor score={score} onChange={(notes) => update({ notes })} selected={selected} onSelect={setSelected} sound={sound} />
          {!toolbarOpen && <NoteChordEditor commitOnBlur score={score} selected={selected} onChange={(chords) => update({ chords })} />}
        </>
      )}

      {editMode && isDrums && editNotes && <DrumEditor score={score} onChange={(notes) => update({ notes })} onPreview={(midi) => sound.playNote(midi)} />}
      {editMode && !isDrums && <ChordEditor key={activePartId} commitOnBlur score={score} onChange={(chords) => update({ chords })} />}

      {/* 내보내기 */}
      <Card className="no-print gap-3 p-4">
        <p className="text-sm font-semibold">내보내기 · {keyName(shownKey)}키 기준</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button type="button" variant="outline" onClick={printOrPdf} disabled={pdfBusy} className="h-11 rounded-full px-4 lg:h-9">
            <Printer aria-hidden /> PDF / 인쇄
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => exportFile(`${base}.musicxml`, scoreToMusicXML(rootScore!, layout), "application/vnd.recordare.musicxml+xml")}
            className="h-11 rounded-full px-4 lg:h-9"
          >
            <FileMusic aria-hidden /> MusicXML
          </Button>
          <Link href={`/scores/${score.id}/share`} className="inline-flex h-11 items-center gap-1.5 rounded-full border border-border px-4 text-sm font-medium outline-none hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9">
            <Share2 className="size-4" aria-hidden /> 공유
          </Link>
          <div className="flex items-center gap-1 rounded-full border border-input pl-3">
            <select
              value={instrument}
              onChange={(e) => isInstrumentId(e.target.value) && setInstrument(e.target.value)}
              className="h-11 rounded-md bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9 [&>option]:bg-surface"
              aria-label="MIDI 멜로디 악기"
            >
              {INSTRUMENT_ORDER.filter((id) => isDrums ? id === "drumKit" : id !== "drumKit").map((id) => (
                <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
              ))}
            </select>
            <Button
              type="button"
              variant="outline"
              onClick={() => exportFile(`${base}_${instrument}.mid`, scoreToMidi(rootScore!, { melodyInstrument: activePartId === MAIN_PART_ID ? instrument : rootScore!.instrument }), "audio/midi")}
              className="h-11 rounded-full border-accent px-4 text-accent hover:bg-accent/10 hover:text-accent lg:h-9"
            >
              <Download aria-hidden /> MIDI
            </Button>
          </div>
        </div>
        <Button
          type="button"
          variant="destructive"
          onClick={() => setConfirmDelete(true)}
          className="h-11 justify-self-start px-4 text-xs lg:h-9"
        >
          <Trash2 aria-hidden /> 악보 삭제
        </Button>
      </Card>
      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title="이 악보를 삭제할까요?"
        description="삭제한 악보는 되돌릴 수 없어요."
        onConfirm={() => {
          deleteScore(score.id);
          toast.success("악보를 삭제했어요");
          router.push("/library");
        }}
      />

      {/* 하단 고정: 재생 + 전조 */}
      <div className="no-print fixed inset-x-0 bottom-[72px] z-10 px-4">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <Button
            type="button"
            onClick={togglePlay}
            className={`size-14 shrink-0 rounded-full text-accent-ink shadow-md [&_svg:not([class*=size-])]:size-6 ${playing ? "bg-tune-bad hover:bg-tune-bad/80" : ""}`}
            aria-label={playing ? "정지" : "재생"}
          >
            {playing ? <Square fill="currentColor" aria-hidden /> : <Play fill="currentColor" aria-hidden />}
          </Button>
          <div className="grid min-w-0 flex-1 gap-1">
            <select
              value={instrument}
              onChange={(e) => isInstrumentId(e.target.value) && setInstrument(e.target.value)}
              className="h-11 w-full rounded-md border border-input bg-surface px-2 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9"
              aria-label="재생 악기"
            >
              {INSTRUMENT_ORDER.filter((id) => isDrums ? id === "drumKit" : id !== "drumKit").map((id) => (
                <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
              ))}
            </select>
            {isDrums ? <p className="text-xs text-ink-soft">드럼은 전조 없이 재생합니다.</p> : <TransposeBar originalKey={score.key} transpose={score.transpose} onChange={(t) => update({ transpose: t })} />}
          </div>
        </div>
      </div>
      <div className="h-44" />
      <div className="score-export" aria-hidden="true">
        <ScoreView showHeader printLayout xml={scoreToMusicXML(rootScore!, "piano")} onHandle={(handle) => { exportHandle.current = handle; }} />
      </div>
    </div>
  );
}

