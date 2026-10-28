"use client";

import { useEffect, useRef, useState } from "react";
import { FileAudio, Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getAudioContext } from "@/lib/audio/context";
import { AudioLimitError, framesFromAudioFile, MAX_AUDIO_BYTES, MAX_AUDIO_SEC } from "@/lib/audio/offline-pitch";
import { startPitchTracking, type TrackerSession } from "@/lib/audio/pitch-tracker";
import { buildScoreFromFrames } from "@/lib/music/pipeline";
import { filterInstrumentFrames } from "@/lib/music/voice-filter";
import type { PitchFrame, Score } from "@/lib/music/types";
import { hasLyrics, mergeImported, type ImportMode } from "./audio-import-logic";

interface AudioImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  score: Score;
  onApply: (patch: Pick<Score, "notes" | "chords">) => void;
}

type Imported = Pick<Score, "notes" | "chords">;

const NO_NOTES = "악기 음을 찾지 못했어요. 목소리는 빼고 악기 소리만 음표로 만들어요.";

const ACCEPT = "audio/mpeg,audio/mp3,audio/wav,audio/x-wav,audio/wave,.mp3,.wav";

const LIMIT_TEXT = `${MAX_AUDIO_BYTES / 1024 / 1024}MB · ${MAX_AUDIO_SEC / 60}분 이하`;

function ImportForm({ score, onApply, onClose }: Omit<AudioImportDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  const [tab, setTab] = useState<"file" | "mic">("file");
  const [busy, setBusy] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Imported | null>(null);
  const [mode, setMode] = useState<ImportMode>("replace");
  const session = useRef<TrackerSession | null>(null);
  const alive = useRef(true);
  const analysis = useRef<AbortController | null>(null);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      analysis.current?.abort(); // 닫히면 파일 분석 즉시 중단 (디코딩한 샘플 참조 해제)
      analysis.current = null;
      session.current?.stop(); // 닫히면 마이크 즉시 해제 (프레임 버림)
      session.current = null;
    };
  }, []);

  /** 프레임 → 목소리 구간 제거 → 악기 음역으로 음표 생성 */
  function build(frames: PitchFrame[]) {
    const built = buildScoreFromFrames(filterInstrumentFrames(frames), {
      bpm: score.bpm,
      beatsPerMeasure: score.beatsPerMeasure,
      range: "instrument",
    });
    if (!built.score.notes.some((n) => n.midi !== null)) {
      setResult(null);
      setError(NO_NOTES);
      return;
    }
    setResult({ notes: built.score.notes, chords: built.score.chords });
  }

  async function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setResult(null);
    setBusy("음원을 분석하는 중… 0%");
    const ac = new AbortController();
    analysis.current = ac;
    try {
      // 파일은 메모리에서만 디코딩·분석하고 버린다 (저장·전송 없음)
      const frames = await framesFromAudioFile(file, (r) => alive.current && setBusy(`음원을 분석하는 중… ${Math.round(r * 100)}%`), ac.signal);
      if (alive.current) build(frames);
    } catch (e) {
      if (!alive.current || ac.signal.aborted) return;
      setError(
        e instanceof AudioLimitError
          ? e.reason === "bytes"
            ? `파일이 너무 커요. ${MAX_AUDIO_BYTES / 1024 / 1024}MB 이하 파일을 골라 주세요.`
            : `음원이 너무 길어요. ${MAX_AUDIO_SEC / 60}분 이하 음원을 골라 주세요.`
          : "이 파일을 읽지 못했어요. MP3 또는 WAV 파일을 골라 주세요.",
      );
    } finally {
      if (analysis.current === ac) analysis.current = null;
      if (alive.current) setBusy(null);
    }
  }

  async function startMic() {
    if (session.current || busy) return;
    setError(null);
    setResult(null);
    getAudioContext(); // 제스처 안에서 동기 호출 (await 금지)
    setBusy("마이크를 여는 중…");
    try {
      const s = await startPitchTracking({ bpm: score.bpm, beatsPerMeasure: score.beatsPerMeasure, meter: score.meter, countInMeasures: 1, metronome: true });
      if (!alive.current) {
        s.stop();
        return;
      }
      session.current = s;
      setRecording(true);
    } catch (e) {
      const name = e instanceof DOMException ? e.name : "";
      setError(
        name === "NotAllowedError"
          ? "마이크 권한이 필요해요. 주소창의 사이트 설정에서 마이크를 허용해 주세요."
          : name === "NotFoundError"
            ? "마이크를 찾을 수 없어요."
            : "마이크를 시작하지 못했어요. 잠시 후 다시 시도해 주세요.",
      );
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  function stopMic() {
    const s = session.current;
    if (!s) return;
    session.current = null;
    setRecording(false);
    build(s.stop());
  }

  function apply() {
    if (!result) return;
    onApply(mergeImported(score, result, mode));
    toast.success(mode === "replace" ? "음표를 새로 바꿨어요" : "음표를 뒤에 붙였어요");
    onClose();
  }

  const count = result?.notes.filter((n) => n.midi !== null).length ?? 0;
  const lyricsLost = mode === "replace" && hasLyrics(score);
  const locked = !!busy || recording;

  return (
    <div className="grid min-w-0 gap-4">
      <Tabs value={tab} onValueChange={(v) => !locked && setTab(v === "mic" ? "mic" : "file")}>
        <TabsList className="w-full">
          <TabsTrigger value="file" disabled={locked}>파일 (MP3·WAV)</TabsTrigger>
          <TabsTrigger value="mic" disabled={locked}>마이크 · 악기 소리</TabsTrigger>
        </TabsList>
        <TabsContent value="file" className="grid gap-2 text-sm">
          <label className="inline-flex h-11 w-fit cursor-pointer items-center gap-2 rounded-full border border-input px-4 hover:bg-muted focus-within:ring-3 focus-within:ring-ring/60 lg:h-9">
            <FileAudio aria-hidden className="size-4" /> 파일 고르기
            <input
              type="file"
              accept={ACCEPT}
              disabled={locked}
              className="sr-only"
              aria-label="음원 파일"
              onChange={(e) => {
                void onFile(e.target.files?.[0]);
                e.target.value = ""; // 같은 파일 다시 고르기 허용
              }}
            />
          </label>
          <p className="text-xs text-ink-soft">{LIMIT_TEXT} 파일만 분석할 수 있어요.</p>
        </TabsContent>
        <TabsContent value="mic" className="grid gap-2 text-sm">
          <Button
            type="button"
            variant="outline"
            onClick={recording ? stopMic : () => void startMic()}
            disabled={!!busy}
            aria-pressed={recording}
            className={`h-11 w-fit rounded-full px-4 lg:h-9 ${recording ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
          >
            {recording ? <Square aria-hidden /> : <Mic aria-hidden />}
            {recording ? "녹음 끝내기" : "악기 녹음 시작"}
          </Button>
          <p className="text-xs text-ink-soft">한 마디 카운트인 뒤 {score.bpm} BPM 메트로놈에 맞춰 연주해 주세요.</p>
        </TabsContent>
      </Tabs>
      <p className="text-xs text-ink-soft">목소리로 보이는 구간은 빼고 악기 소리만 음표로 만들어요. 소리는 기기 안에서만 처리하고 저장하지 않아요.</p>

      {busy && <p className="text-sm text-ink-soft" role="status">{busy}</p>}
      {error && <p className="text-sm text-tune-bad" role="alert">{error}</p>}

      {result && (
        <fieldset className="grid gap-2 text-sm">
          <legend className="mb-1 font-medium">음표 {count}개를 찾았어요. 어떻게 넣을까요?</legend>
          {(
            [
              ["replace", "지금 음표를 바꾸기"],
              ["append", "지금 악보 뒤에 붙이기"],
            ] as const
          ).map(([v, label]) => (
            <label key={v} className="flex min-h-11 items-center gap-2 lg:min-h-9">
              <input type="radio" name="import-mode" value={v} checked={mode === v} onChange={() => setMode(v)} className="h-5 w-5 accent-accent" />
              {label}
            </label>
          ))}
          {lyricsLost && <p className="text-tune-bad" role="alert">바꾸면 지금 달린 가사가 사라져요.</p>}
        </fieldset>
      )}

      <DialogFooter className="gap-2">
        <Button type="button" variant="outline" onClick={onClose} className="h-11 px-4 text-sm">
          취소
        </Button>
        <Button type="button" onClick={apply} disabled={!result || locked} className="h-11 px-4 text-sm">
          적용
        </Button>
      </DialogFooter>
    </div>
  );
}

export function AudioImportDialog({ open, onOpenChange, score, onApply }: AudioImportDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>음원 등록</DialogTitle>
          <DialogDescription>악기 연주 음원이나 마이크 연주로 음표를 만들어요.</DialogDescription>
        </DialogHeader>
        {open && <ImportForm score={score} onApply={onApply} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
