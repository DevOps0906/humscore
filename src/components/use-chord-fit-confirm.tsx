"use client";

import { useCallback, useState, type ReactNode } from "react";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { chordChangeMisfits, describeMisfit, type ChordMisfit } from "@/lib/music/chord-fit";
import { transposeKey } from "@/lib/music/theory";
import type { ChordEvent, Score } from "@/lib/music/types";

/**
 * 코드를 바꾸기 전에, 새 코드가 지금 멜로디 음과 어울리는지(대리코드 포함) 확인한다.
 * 어울리지 않는 음이 있으면 모달로 물어보고, 확인했을 때만 변경을 실행한다.
 */
export function useChordFitConfirm(score: Pick<Score, "notes" | "chords" | "beatsPerMeasure" | "key" | "transpose">): {
  request: (nextChords: readonly ChordEvent[], apply: () => void) => void;
  pending: boolean;
  dialog: ReactNode;
} {
  const [state, setState] = useState<{ misfits: ChordMisfit[]; apply: () => void } | null>(null);

  const request = useCallback((nextChords: readonly ChordEvent[], apply: () => void) => {
    const misfits = chordChangeMisfits(score, nextChords);
    if (misfits.length === 0) { apply(); return; }
    setState({ misfits, apply });
  }, [score]);

  const flats = transposeKey(score.key, score.transpose).fifths < 0;
  const lines = (state?.misfits ?? []).slice(0, 4).map((misfit) => describeMisfit(misfit, score.beatsPerMeasure, flats));
  const extra = (state?.misfits.length ?? 0) - lines.length;
  const dialog = (
    <ConfirmDialog
      open={state !== null}
      onOpenChange={(open) => { if (!open) setState(null); }}
      title="멜로디와 어울리지 않는 코드예요"
      description={`이 코드(대리코드 포함)와 맞지 않는 음이 있어요: ${lines.join(" / ")}${extra > 0 ? ` 외 ${extra}개` : ""}. 그래도 코드를 변경할까요?`}
      confirmLabel="그래도 변경"
      onConfirm={() => { const apply = state?.apply; setState(null); apply?.(); }}
    />
  );
  return { request, pending: state !== null, dialog };
}
