/** 드럼의 GM 재생 음과 오선보 위치를 별도로 정의한다. MIDI 번호는 전조하지 않는다. */
export interface DrumPiece {
  id: string;
  label: string;
  midi: number;
  staffStep: "A" | "B" | "C" | "D" | "E" | "F" | "G";
  staffOctave: number;
  head: "normal" | "x" | "diamond";
}

export const DRUM_PIECES: readonly DrumPiece[] = [
  { id: "kick", label: "베이스드럼", midi: 36, staffStep: "F", staffOctave: 4, head: "normal" },
  { id: "snare", label: "스네어", midi: 38, staffStep: "C", staffOctave: 5, head: "normal" },
  { id: "closedHat", label: "닫힌 하이햇", midi: 42, staffStep: "G", staffOctave: 5, head: "x" },
  { id: "openHat", label: "열린 하이햇", midi: 46, staffStep: "G", staffOctave: 5, head: "x" },
  { id: "pedalHat", label: "페달 하이햇", midi: 44, staffStep: "D", staffOctave: 4, head: "x" },
  { id: "crash", label: "크래시", midi: 49, staffStep: "A", staffOctave: 5, head: "x" },
  { id: "ride", label: "라이드", midi: 51, staffStep: "F", staffOctave: 5, head: "diamond" },
  { id: "highTom", label: "하이 탐", midi: 50, staffStep: "E", staffOctave: 5, head: "normal" },
  { id: "midTom", label: "미들팜", midi: 47, staffStep: "D", staffOctave: 5, head: "normal" },
  { id: "floorTom", label: "플로어 탐", midi: 43, staffStep: "A", staffOctave: 4, head: "normal" },
  { id: "rim", label: "림·크로스스틱", midi: 37, staffStep: "C", staffOctave: 5, head: "x" },
];

export function drumPiece(midi: number): DrumPiece | undefined {
  return DRUM_PIECES.find((piece) => piece.midi === midi);
}
