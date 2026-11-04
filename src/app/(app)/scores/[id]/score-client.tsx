"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AudioLines, Download, FileMusic, Play, Printer, Share2, Square, Trash2, Type } from "lucide-react";
import { toast } from "sonner";
import { AudioImportDialog } from "@/components/audio-import-dialog";
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
import { deleteScore, getScore, saveScore } from "@/lib/storage/scores";
import type { Score } from "@/lib/music/types";
import { isGuitarInstrument, type GuitarInstrumentId } from "@/lib/music/tablature";

const compositionSignature = (score: Score) => JSON.stringify([score.notes, score.chords, score.marks, score.dynamics]);

export function ScoreClient({ id }: { id: string }) {
  const router = useRouter();
  const { score, update: persist } = useScore(id);
  const [compositionMode, setCompositionMode] = useState<CompositionMode | null>(null);
  const [compositionUndo, setCompositionUndo] = useState<{ patch: Partial<Score>; expected: string } | null>(null);
  function update(patch: Partial<Score>) {
    setCompositionUndo(null);
    persist(patch);
  }
  const [layout, setLayout] = useState<ScoreLayout>("lead");
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
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const sound = usePianoSound(instrument);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [pdfBusy, setPdfBusy] = useState(false);
  const [lyricsOpen, setLyricsOpen] = useState(false);
  const [audioOpen, setAudioOpen] = useState(false);
  // '내 악보 → 음원 파일'로 들어오면(?import=audio) 음원 등록 창을 바로 연다. 적용 없이 닫으면 빈 악보는 지운다
  const fromImport = useRef(false);
  useEffect(() => {
    if (new URLSearchParams(window.location.search).get("compose") === "1") {
      setCompositionMode("compose"); // eslint-disable-line react-hooks/set-state-in-effect -- 작곡 진입 주소를 마운트 후 읽는다
      window.history.replaceState(null, "", window.location.pathname);
    }
    if (new URLSearchParams(window.location.search).get("import") !== "audio") return;
    fromImport.current = true;
    window.history.replaceState(null, "", window.location.pathname);
    setAudioOpen(true);
  }, []);
  const viewHandle = useRef<ScoreViewHandle | null>(null);
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

  const xml = useMemo(() => (score ? scoreToMusicXML(score, layout, { externalHeader: true }) : ""), [score, layout]);

  const noteCount = score?.notes.length ?? 0;
  const selected = selectedRaw !== null && selectedRaw < noteCount ? selectedRaw : null;

  useScoreEditKeys({
    enabled: !isDrums && editNotes && !lyricsOpen && !audioOpen && compositionMode === null,
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
    const target = score!;
    const doPlay = () => {
      playback.current = playScore(ctx, target, { instrument });
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
  const header = <ScoreHeader score={score} />;
  const base = `${safeFileName(score.title)}_${keyName(shownKey)}`;

  // 웹은 브라우저 인쇄, 앱은 이미지 PDF를 만들어 공유 시트로
  const printOrPdf = async () => {
    if (!isNativeApp()) return window.print();
    const view = viewHandle.current;
    if (!view || pdfBusy) return;
    setPdfBusy(true);
    const credits = [
      score.lyricist && `작사 ${score.lyricist}`,
      score.composer && `작곡 ${score.composer}`,
      score.arranger && `편곡 ${score.arranger}`,
    ]
      .filter(Boolean)
      .join(" · ");
    const t = toast.loading("PDF를 만드는 중…");
    try {
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
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <InlineField
            label="제목"
            ariaLabel="악보 제목"
            value={score.title}
            onCommit={(t) => {
              update({ title: t });
              toast.success("제목을 저장했어요");
            }}
            className="[&_input]:text-xl [&_input]:font-medium"
          />
          <div className="grid gap-x-2 md:grid-cols-3">
            {(
              [
                ["lyricist", "작사", score.lyricist],
                ["composer", "작곡", score.composer],
                ["arranger", "편곡", score.arranger],
              ] as const
            ).map(([field, label, val]) => (
              <InlineField
                key={field}
                label={label}
                ariaLabel={`${label}자`}
                placeholder={`${label}자 (선택)`}
                allowEmpty
                value={val ?? ""}
                onCommit={(t) => {
                  update({ [field]: t || undefined });
                  toast.success(`${label}자를 저장했어요`);
                }}
              />
            ))}
          </div>
        </div>
        <Button asChild variant="outline" className="h-11 shrink-0 rounded-full px-4 text-sm">
          <Link href={`/scores/${score.id}/perform`}>공연 모드</Link>
        </Button>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        {!isDrums && (["lead", "piano"] as const).map((l) => (
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
      <HeaderSettings score={score} onChange={(p) => update(p)} />

      <ScoreView
        onHandle={(h) => {
          viewHandle.current = h;
        }}
        showHeader={false}
        header={header}
        xml={xml}
        chordEditor={!isDrums && editNotes ? { chords: score.chords, onSelect: (startBeat) => { setChordEditingBeat(startBeat); setToolbarOpen(false); } } : undefined}
        cursor={
          !isDrums && editNotes
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
                  {curNote.midi !== null && <NoteChordEditor score={score} selected={selected} onChange={(chords) => update({ chords })} />}
                </>) : null,
              }
            : undefined
        }
      />

      {!isDrums && showTab && <TabScoreView score={score} instrument={tabInstrument} />}
      <Dialog open={chordEditingBeat !== null} onOpenChange={(open) => { if (!open) setChordEditingBeat(null); }}>
        <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-lg">
          <DialogHeader><DialogTitle>코드 변경</DialogTitle><DialogDescription>선택한 위치의 코드 근음과 종류를 고르고 적용해 주세요.</DialogDescription></DialogHeader>
          {chordEditingBeat !== null && <NoteChordEditor score={score} selected={null} startBeat={chordEditingBeat} onChange={(chords) => update({ chords })} />}
        </DialogContent>
      </Dialog>

      <div className="no-print flex flex-wrap gap-2">
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => { clearPlayback(); setPlaying(false); setCompositionMode("compose"); }} className="h-11 rounded-full px-4 text-sm lg:h-9">
          작곡
        </Button>
        <Button type="button" variant="outline" disabled={isDrums} onClick={() => { clearPlayback(); setPlaying(false); setCompositionMode("reharmonize"); }} className="h-11 rounded-full px-4 text-sm lg:h-9">
          고급 리하모니제이션
        </Button>
        {compositionUndo && <Button type="button" variant="outline" disabled={compositionSignature(score) !== compositionUndo.expected} onClick={() => {
          clearPlayback(); setPlaying(false);
          persist(compositionUndo.patch); setCompositionUndo(null); setSelected(null);
          toast.success("작곡·리하모니 적용 전으로 되돌렸어요");
        }} className="h-11 rounded-full px-4 text-sm lg:h-9">작곡·리하모니 되돌리기</Button>}
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditNotes((v) => !v)}
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
      {compositionMode !== null && <CompositionDialog
        key={compositionMode}
        score={score}
        mode={compositionMode}
        instrument={instrument}
        onClose={() => setCompositionMode(null)}
        onApply={async (patch) => {
          const before = { notes: score.notes, chords: score.chords, marks: score.marks, dynamics: score.dynamics };
          const saved = await saveScore({ ...score, ...patch });
          if (getScore(saved.id)?.updatedAt !== saved.updatedAt) {
            throw new Error("악보를 저장하지 못했어요. 기기 저장 공간을 확인하고 다시 시도해 주세요.");
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
      {editNotes && !isDrums && (
        <>
          <NoteEditor score={score} onChange={(notes) => update({ notes })} selected={selected} onSelect={setSelected} sound={sound} />
          {!toolbarOpen && <NoteChordEditor score={score} selected={selected} onChange={(chords) => update({ chords })} />}
        </>
      )}

      {isDrums && editNotes && <DrumEditor score={score} onChange={(notes) => update({ notes })} onPreview={(midi) => sound.playNote(midi)} />}
      {!isDrums && <ChordEditor score={score} onChange={(chords) => update({ chords })} />}

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
            onClick={() => exportFile(`${base}.musicxml`, scoreToMusicXML(score, layout), "application/vnd.recordare.musicxml+xml")}
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
              onClick={() => exportFile(`${base}_${instrument}.mid`, scoreToMidi(score, { melodyInstrument: instrument }), "audio/midi")}
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
    </div>
  );
}

