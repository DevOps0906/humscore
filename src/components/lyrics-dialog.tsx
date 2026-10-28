"use client";

import { useState } from "react";
import { Mic, Square } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLocalSpeech } from "@/hooks/use-local-speech";
import { applyLyrics, lyricText, splitLyrics } from "@/lib/music/lyrics";
import { MAX_LYRIC_LENGTH } from "@/lib/storage/score-schema";
import type { NoteEvent } from "@/lib/music/types";

interface LyricsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  notes: NoteEvent[];
  /** 가사를 붙이기 시작할 음표(선택 음표, 없으면 0) */
  fromIndex: number;
  onApply: (notes: NoteEvent[]) => void;
}

/** 지금 달린 가사를 편집용 텍스트로 (이어지는 음절은 하이픈 유지) */
function currentLyricsText(notes: NoteEvent[]): string {
  return notes
    .filter((n) => n.lyric)
    .map((n) => n.lyric!)
    .reduce((s, l, i, arr) => s + l + (l.endsWith("-") || i === arr.length - 1 ? "" : " "), "");
}

function LyricsForm({ notes, fromIndex, onApply, onClose }: Omit<LyricsDialogProps, "open" | "onOpenChange"> & { onClose: () => void }) {
  // 적용은 fromIndex 부터 다시 배정하므로, 초기 텍스트도 그 이후 가사만 (앞 가사 복제 방지)
  const [text, setText] = useState(() => currentLyricsText(notes.slice(fromIndex)));
  const speech = useLocalSpeech(true, (t) => t && setText((prev) => (prev.trim() ? `${prev.trimEnd()} ${t}` : t)));
  const syllables = splitLyrics(text);
  const slots = notes.slice(fromIndex).filter((n) => n.midi !== null).length;
  const hasAny = notes.some((n) => n.lyric);
  const tooLong = syllables.some((s) => s.length > MAX_LYRIC_LENGTH);

  function apply() {
    // 시작 음표부터 기존 가사를 지우고 새로 배정
    const cleared = notes.map((n, i) => (i >= fromIndex && n.lyric ? { ...n, lyric: undefined } : n));
    const r = applyLyrics(cleared, syllables, fromIndex);
    onApply(r.notes);
    if (r.rest.length) toast.warning(`음표가 모자라 ${r.rest.length}음절이 남았어요: ${r.rest.map(lyricText).join(" ")}`);
    else toast.success("가사를 붙였어요");
    onClose();
  }

  function clearAll() {
    onApply(notes.map((n) => (n.lyric ? { ...n, lyric: undefined } : n)));
    toast.success("가사를 지웠어요");
    onClose();
  }

  return (
    <div className="grid gap-4">
      <div className="grid gap-2 text-sm">
        {speech.status === "checking" && <p className="text-ink-soft" role="status">음성 입력을 확인하는 중…</p>}
        {speech.status === "unsupported" && (
          <p className="text-ink-soft">이 기기에서는 음성 가사 입력을 지원하지 않아요. 아래에 직접 입력해 주세요.</p>
        )}
        {speech.status === "downloadable" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-ink-soft">기기 안 음성 인식을 쓰려면 한국어 인식 데이터를 한 번 설치해야 해요.</p>
            <Button type="button" variant="outline" onClick={() => void speech.install()} className="h-11 rounded-full px-4 lg:h-9">
              한국어 인식 설치
            </Button>
          </div>
        )}
        {speech.status === "downloading" && <p className="text-ink-soft" role="status">한국어 인식 데이터를 설치하는 중…</p>}
        {(speech.status === "idle" || speech.status === "available") && (
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={speech.listening ? speech.stop : () => void speech.start()}
              aria-pressed={speech.listening}
              className={`h-11 rounded-full px-4 lg:h-9 ${speech.listening ? "border-accent bg-accent/15 text-accent hover:bg-accent/20 hover:text-accent" : ""}`}
            >
              {speech.listening ? <Square aria-hidden /> : <Mic aria-hidden />}
              {speech.listening ? "그만 듣기" : "말로 입력"}
            </Button>
            <span className="text-xs text-ink-soft">가사를 읽어 주세요. 음정은 인식하지 않아요(기기 안에서만 처리).</span>
          </div>
        )}
        {speech.interim && <p className="text-ink-soft" aria-live="polite">{speech.interim}</p>}
        {speech.error && <p className="text-tune-bad" role="alert">{speech.error}</p>}
      </div>
      <label className="grid gap-1.5 text-sm">
        <span className="text-ink-soft">가사 (한글은 글자마다, 영어는 단어마다 음표 하나 · 하이픈으로 음절 나눔)</span>
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="예: 반짝 반짝 작은 별"
          className="min-h-24 w-full rounded-md border border-input bg-transparent px-3 py-2 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/60"
        />
      </label>
      <p className="text-xs text-ink-soft" aria-live="polite">
        {fromIndex + 1}번째 음표부터 · {syllables.length}음절 / 붙일 수 있는 음표 {slots}개
        {syllables.length > slots ? ` · ${syllables.length - slots}음절이 남아요` : ""}
      </p>
      {tooLong && <p className="text-sm text-tune-bad" role="alert">음표 하나에 붙는 가사는 {MAX_LYRIC_LENGTH}자까지예요. 긴 단어는 하이픈(-)으로 나눠 주세요.</p>}
      <DialogFooter className="gap-2">
        {hasAny && (
          <Button type="button" variant="outline" onClick={clearAll} className="h-11 px-4 text-sm sm:mr-auto">
            가사 지우기
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onClose} className="h-11 px-4 text-sm">
          취소
        </Button>
        <Button type="button" onClick={apply} disabled={syllables.length === 0 || slots === 0 || tooLong} className="h-11 px-4 text-sm">
          적용
        </Button>
      </DialogFooter>
    </div>
  );
}

export function LyricsDialog({ open, onOpenChange, notes, fromIndex, onApply }: LyricsDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>가사 등록</DialogTitle>
          <DialogDescription>말로 읽거나 직접 입력한 가사를 음표에 하나씩 붙여요.</DialogDescription>
        </DialogHeader>
        {/* 열릴 때마다 새로 마운트되어 입력·인식 상태가 초기화됨 */}
        {open && <LyricsForm notes={notes} fromIndex={fromIndex} onApply={onApply} onClose={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  );
}
