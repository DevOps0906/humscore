"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { scoreTypography } from "@/lib/music/header-fonts";
import { ScoreView } from "@/components/score-view";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import { playScore, type Playback } from "@/lib/audio/piano-synth";
import type { InstrumentId } from "@/lib/music/midi";
import { composeMelody, reharmonize, type MelodyStyle, type ReharmStyle } from "@/lib/music/compose";
import { applyComposedPhrase, type CompositionPlacement } from "@/lib/music/composition-apply";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import { scoreMeasureCount } from "@/lib/music/edit";
import { midiToName } from "@/lib/music/frequency";
import { PROGRESSIONS } from "@/lib/music/progressions";
import { transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import type { Score } from "@/lib/music/types";

export type CompositionMode = "compose" | "reharmonize";
const field = "h-11 min-w-0 w-full rounded-md border border-input bg-surface px-3 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/60";
const signature = (s: Score) => JSON.stringify([s.notes, s.chords, s.key, s.beatsPerMeasure, s.meter, s.bpm, s.transpose, s.marks, s.dynamics]);

export function CompositionDialog({ score, mode, instrument = "piano", onClose, onApply }: {
  score: Score;
  mode: CompositionMode;
  instrument?: InstrumentId;
  onClose: () => void;
  onApply: (patch: Partial<Score>) => void | Promise<void>;
}) {
  const [measures, setMeasures] = useState(8);
  const [progressionId, setProgressionId] = useState("pop4");
  const [style, setStyle] = useState<MelodyStyle>("balanced");
  const [reharmStyle, setReharmStyle] = useState<ReharmStyle>("gentle");
  const [useExisting, setUseExisting] = useState(score.chords.length > 0);
  const [placement, setPlacement] = useState<CompositionPlacement>("append");
  const [preview, setPreview] = useState<{ score: Score; source: string } | null>(null);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const applying = useRef(false);
  const playback = useRef<Playback | null>(null);
  const pendingPlayback = useRef<(() => void) | null>(null);
  const [playing, setPlaying] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    pendingPlayback.current?.();
    playback.current?.stop();
    if (timer.current) clearTimeout(timer.current);
  }, []);

  function stop() {
    pendingPlayback.current?.();
    pendingPlayback.current = null;
    playback.current?.stop();
    playback.current = null;
    if (timer.current) clearTimeout(timer.current);
    setPlaying(false);
  }
  function invalidate() { stop(); setPreview(null); setError(""); }
  function generate() {
    stop();
    try {
      const phrase = mode === "compose"
        ? composeMelody(score, { measures, progressionId, style, seed: Math.floor(Math.random() * 0x7fffffff), useExistingChords: useExisting })
        : { notes: score.notes, chords: reharmonize(score, reharmStyle) };
      setPreview({ score: { ...score, ...phrase, ...(mode === "compose" ? { marks: undefined, dynamics: undefined } : {}) }, source: signature(score) });
      setError("");
    } catch (e) { setPreview(null); setError(e instanceof Error ? e.message : "후보를 만들지 못했어요."); }
  }
  const fresh = preview?.source === signature(score);
  const shownKey = transposeKey(score.key, score.transpose);
  const chordLabel = (symbol: string) => transposeChordSymbol(symbol, score.transpose, shownKey.fifths < 0);
  function listen() {
    if (playing) { stop(); return; }
    if (!preview || !fresh) return;
    setAudioSessionType("playback");
    const ctx = getAudioContext(); // 사용자 제스처 안에서 동기 호출, resume을 await하지 않는다.
    const target = preview.score;
    setPlaying(true);
    const start = () => {
      try {
        playback.current = playScore(ctx, target, { instrument });
        timer.current = setTimeout(stop, (playback.current.durationSec + 1) * 1000);
      } catch {
        stop(); setError("미리듣기를 시작하지 못했어요. 다시 눌러 주세요.");
      }
    };
    if (ctx.state === "running") { start(); return; }
    let startupTimer: ReturnType<typeof setTimeout> | null = null;
    const release = () => {
      ctx.removeEventListener("statechange", ready);
      if (startupTimer) clearTimeout(startupTimer);
      pendingPlayback.current = null;
    };
    function ready() {
      if (ctx.state === "running") { release(); start(); }
    }
    ctx.addEventListener("statechange", ready);
    startupTimer = setTimeout(() => { release(); setPlaying(false); setError("오디오가 대기 중이에요. 미리듣기를 다시 눌러 주세요."); }, 3000);
    pendingPlayback.current = release;
  }
  async function apply(save = false) {
    if (!preview || !fresh || applying.current) return;
    applying.current = true;
    setSaving(true);
    try {
      const patch = mode === "compose" ? applyComposedPhrase(score, preview.score, placement) : { chords: preview.score.chords };
      stop();
      await onApply(patch);
      toast.success(save ? "작곡한 악보를 저장했어요" : mode === "compose" ? "멜로디를 적용했어요" : "리하모니제이션을 적용했어요");
      onClose();
    } catch (e) { setError(e instanceof Error ? e.message : "후보를 저장하지 못했어요. 다시 시도해 주세요."); }
    finally { applying.current = false; setSaving(false); }
  }
  return (
    <Dialog open onOpenChange={(open) => { if (!open && !applying.current) onClose(); }}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>{mode === "compose" ? "작곡" : "고급 리하모니제이션"}</DialogTitle>
          <DialogDescription>{mode === "compose"
            ? "코드 구성음·음계·반복 동기와 종지 패턴으로 새 멜로디 후보를 만들어요. 특정 곡을 복사하거나 외부로 악보를 보내지 않아요."
            : "멜로디와 가사를 유지하면서 어울리는 대리 코드를 제안해요. 원래 진행과 비교하고 적용해 주세요."}</DialogDescription>
        </DialogHeader>
        {mode === "compose" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="grid gap-1.5 text-sm">마디 수 (1~32)
              <input type="number" min={1} max={32} step={1} aria-label="작곡 마디 수" value={measures} onChange={(e) => { invalidate(); setMeasures(Number(e.target.value)); }} className={field} />
            </label>
            <label className="grid gap-1.5 text-sm">멜로디 구조
              <select value={style} onChange={(e) => { invalidate(); setStyle(e.target.value as MelodyStyle); }} className={field}>
                <option value="balanced">균형 있는 진행</option><option value="lyrical">서정적인 선율</option><option value="rhythmic">리듬감 있는 선율</option>
              </select>
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">코드 진행
              <select aria-label="작곡 코드 진행" disabled={useExisting} value={progressionId} onChange={(e) => { invalidate(); setProgressionId(e.target.value); }} className={field}>
                {PROGRESSIONS.map((p) => <option key={p.id} value={p.id}>{p.name} · {score.key.mode === "minor" ? p.minorRoman : p.roman}</option>)}
              </select>
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
              <input type="checkbox" checked={useExisting} disabled={!score.chords.length} onChange={(e) => { invalidate(); setUseExisting(e.target.checked); }} className="size-5 accent-accent" /> 현재 악보의 코드 진행 사용
            </label>
            <label className="grid gap-1.5 text-sm sm:col-span-2">멜로디를 넣을 위치
              <select aria-label="멜로디 적용 위치" value={placement} onChange={(e) => setPlacement(e.target.value as CompositionPlacement)} className={field}>
                <option value="append">마지막 마디 뒤에 추가</option><option value="replace">기존 음표·가사를 새 멜로디로 교체</option>
              </select>
            </label>
            {placement === "replace" && score.notes.length > 0 && <p className="text-sm text-tune-warn sm:col-span-2">적용하면 기존 음표·가사·셈여림·진행 기호를 새 멜로디로 바꿔요. 적용 후 ‘작곡·리하모니 되돌리기’로 복원할 수 있어요.</p>}
          </div>
        ) : (
          <label className="grid gap-1.5 text-sm">리하모니제이션 방식
            <select aria-label="리하모니제이션 방식" value={reharmStyle} onChange={(e) => { invalidate(); setReharmStyle(e.target.value as ReharmStyle); }} className={field}>
              <option value="gentle">부드러운 대리 코드</option><option value="jazz">재즈 화성</option><option value="color">색채 화성</option>
            </select>
          </label>
        )}
        <Button type="button" onClick={generate} disabled={mode === "compose" ? !Number.isInteger(measures) || measures < 1 || measures > 32 : !score.notes.some((n) => n.midi !== null)} className="h-11">
          {preview ? "다른 후보 만들기" : mode === "compose" ? "멜로디 후보 만들기" : "리하모니 후보 만들기"}
        </Button>
        {mode === "reharmonize" && !score.notes.some((n) => n.midi !== null) && <p role="status" className="text-sm text-ink-soft">먼저 멜로디를 입력하거나 작곡으로 만들어 주세요.</p>}
        {error && <p role="alert" className="text-sm text-tune-bad">{error}</p>}
        {preview && <div className="grid min-w-0 gap-3" aria-label="작곡 후보 미리보기">
          {!fresh && <p role="alert" className="text-sm text-tune-warn">악보가 변경됐어요. 현재 악보로 후보를 다시 만들어 주세요.</p>}
          <p role="status" className="text-sm">{scoreMeasureCount(preview.score)}마디 · {preview.score.notes.length}개 음표 · {preview.score.chords.map((c) => chordLabel(c.symbol)).join(" → ")}</p>
          {mode === "reharmonize" && <p className="text-xs text-ink-soft">기존 진행: {score.chords.length ? score.chords.map((c) => chordLabel(c.symbol)).join(" → ") : "없음"}</p>}
          <ScoreView typography={scoreTypography(preview.score)} xml={scoreToMusicXML(preview.score, "lead", { externalHeader: true })} />
          {mode === "compose" && <p className="break-words text-xs text-ink-soft">추천 음정: {preview.score.notes.slice(0, 24).map((n) => n.midi === null ? "쉼표" : midiToName(n.midi + score.transpose, shownKey.fifths < 0)).join(" · ")}{preview.score.notes.length > 24 ? " …" : ""}</p>}
        </div>}
        <DialogFooter className="gap-2">
          <Button type="button" variant="outline" onClick={onClose} disabled={saving} className="h-11">취소</Button>
          <Button type="button" variant="outline" onClick={listen} disabled={!preview || !fresh || saving} className="h-11">{playing ? "미리듣기 중지" : "후보 미리듣기"}</Button>
          <Button type="button" onClick={() => void apply()} disabled={!preview || !fresh || saving} className="h-11">{mode === "reharmonize" ? "리하모니 적용" : placement === "replace" && score.notes.length > 0 ? "기존 음표를 바꾸고 적용" : "멜로디 적용"}</Button>
          {mode === "compose" && <Button type="button" onClick={() => void apply(true)} disabled={!preview || !fresh || saving} className="h-11">{saving ? "저장 중…" : "저장하기"}</Button>}
        </DialogFooter>
        {mode === "compose" && <p className="text-xs text-ink-soft">저장하기는 선택한 위치에 후보를 적용해 현재 악보에 저장합니다. 후보를 먼저 만든 뒤 저장해 주세요.</p>}
      </DialogContent>
    </Dialog>
  );
}
