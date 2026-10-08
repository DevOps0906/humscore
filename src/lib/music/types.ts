/** 악보 내부 표현 — 모든 입력(허밍·파일·향후 GPU 채보)이 이 형식으로 모이고, 모든 출력이 여기서 갈라집니다. */

export interface NoteEvent {
  /** MIDI 번호(21=A0 ~ 108=C8). null 이면 쉼표 */
  midi: number | null;
  /** 곡 시작부터의 위치(박 단위, 4/4에서 1박 = 4분음표) */
  startBeat: number;
  /** 길이(박 단위) */
  durationBeats: number;
}

export interface ChordEvent {
  startBeat: number;
  /** 예: "C", "Am", "G7", "F#m" */
  symbol: string;
}

export interface KeyInfo {
  /** 으뜸음 피치 클래스(0=C ... 11=B) */
  tonic: number;
  mode: "major" | "minor";
  /** 조표: -7(7♭) ~ +7(7♯) */
  fifths: number;
}

export interface Score {
  id: string;
  title: string;
  bpm: number;
  beatsPerMeasure: number;
  /** 기본 4분음표 = 1박 */
  beatUnit: 4;
  key: KeyInfo;
  notes: NoteEvent[];
  chords: ChordEvent[];
  /** 원본 대비 반음 이동량(전조). 데이터는 원본 그대로 두고 출력 시 적용 */
  transpose: number;
  createdAt: string;
  updatedAt: string;
}

/** 피치 검출기가 프레임마다 내보내는 값 */
export interface PitchFrame {
  /** 녹음 시작 기준 초 */
  time: number;
  /** 검출 주파수(Hz). 무성/잡음이면 null */
  freq: number | null;
  /** 0~1, 검출 신뢰도 */
  clarity: number;
}

/** 프레임을 묶은 '연주된 음' (아직 박자 정렬 전, 초 단위) */
export interface RawNote {
  midi: number | null;
  startSec: number;
  endSec: number;
  /** 구간 평균 음정 오차(센트). 음정 코칭에 사용 */
  meanCents: number;
}
