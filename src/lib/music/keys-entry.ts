/**
 * 건반 화면의 악보 입력·편집·마침 단계.
 * 8마디 패드는 MusicXML 출력 전용(minMeasures)이며 Score.notes 에는 빈 마디를 넣지 않는다.
 */

export type KeysScorePhase = "idle" | "input" | "edit" | "done";

/** 악보 입력 시작 시 미리보기에 깔아 두는 최소 마디 수 */
export const KEYS_INPUT_PAD_MEASURES = 8;

export function keysShowsScore(phase: KeysScorePhase): boolean {
  return phase !== "idle";
}

export function keysCanAppend(phase: KeysScorePhase): boolean {
  return phase === "input" || phase === "edit";
}

/** 입력 중만 8마디로 패딩. 편집·마침·저장은 실제 음표 마디만(마지막에 마침줄). */
export function keysPreviewMinMeasures(phase: KeysScorePhase): number | undefined {
  return phase === "input" ? KEYS_INPUT_PAD_MEASURES : undefined;
}

export function keysToggleInput(phase: KeysScorePhase): KeysScorePhase {
  return phase === "input" ? "done" : "input";
}
