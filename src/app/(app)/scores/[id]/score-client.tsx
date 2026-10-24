"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Download, FileMusic, Play, Printer, Square, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChordEditor } from "@/components/chord-editor";
import { NoteEditor } from "@/components/note-editor";
import { ScoreView } from "@/components/score-view";
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
import { exportFile, safeFileName } from "@/lib/platform/export-file";
import { deleteScore } from "@/lib/storage/scores";

export function ScoreClient({ id }: { id: string }) {
  const router = useRouter();
  const { score, update } = useScore(id);
  const [layout, setLayout] = useState<ScoreLayout>("lead");
  const [instrument, setInstrument] = useInstrument();
  const [editNotes, setEditNotes] = useState(false);
  const [selectedRaw, setSelected] = useState<number | null>(null);
  const [toolbarOpen, setToolbarOpen] = useState(false);
  const sound = usePianoSound(instrument);
  const [playing, setPlaying] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
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
    enabled: editNotes,
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
        {(["lead", "piano"] as const).map((l) => (
          <Button
            key={l}
            type="button"
            variant="outline"
            onClick={() => setLayout(l)}
            aria-pressed={layout === l}
            className={`h-11 rounded-full px-4 lg:h-9 ${layout === l ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
          >
            {l === "lead" ? "코드 악보" : "피아노"}
          </Button>
        ))}
        <span className="ml-auto text-ink-soft">
          {score.bpm} BPM · <span className="text-xs">{meterLabel}</span>
        </span>
      </div>
      <HeaderSettings score={score} onChange={(p) => update(p)} />

      <ScoreView
        showHeader={false}
        header={header}
        xml={xml}
        cursor={
          editNotes
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
                toolbar: curNote ? (
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
                      update({ dynamics: next.dynamics }); // 비면 undefined 로 덮어써서 키를 지움
                    }}
                    measureNumber={curMeasure + 1}
                    activeMarks={(score.marks ?? []).filter((m) => m.measure === curMeasure).map((m) => m.kind)}
                    onToggleMark={(k) => update({ marks: toggleMeasureMark(score, curMeasure, k).marks })}
                  />
                ) : null,
              }
            : undefined
        }
      />

      <div className="no-print">
        <Button
          type="button"
          variant="outline"
          onClick={() => setEditNotes((v) => !v)}
          aria-pressed={editNotes}
          className={`h-11 rounded-full px-4 text-sm lg:h-9 ${editNotes ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
        >
          음표 편집
        </Button>
      </div>
      {editNotes && (
        <NoteEditor score={score} onChange={(notes) => update({ notes })} selected={selected} onSelect={setSelected} sound={sound} />
      )}

      <ChordEditor score={score} onChange={(chords) => update({ chords })} />

      {/* 내보내기 */}
      <Card className="no-print gap-3 p-4">
        <p className="text-sm font-semibold">내보내기 · {keyName(shownKey)}키 기준</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <Button type="button" variant="outline" onClick={() => window.print()} className="h-11 rounded-full px-4 lg:h-9">
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
          <div className="flex items-center gap-1 rounded-full border border-input pl-3">
            <select
              value={instrument}
              onChange={(e) => isInstrumentId(e.target.value) && setInstrument(e.target.value)}
              className="h-11 rounded-md bg-transparent text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60 lg:h-9 [&>option]:bg-surface"
              aria-label="MIDI 멜로디 악기"
            >
              {INSTRUMENT_ORDER.map((id) => (
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
              {INSTRUMENT_ORDER.map((id) => (
                <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
              ))}
            </select>
            <TransposeBar originalKey={score.key} transpose={score.transpose} onChange={(t) => update({ transpose: t })} />
          </div>
        </div>
      </div>
      <div className="h-44" />
    </div>
  );
}

