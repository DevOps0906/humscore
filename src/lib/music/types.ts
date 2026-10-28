/** 악보 내부 표현 — 모든 입력(허밍·파일·향후 GPU 채보)이 이 형식으로 모이고, 모든 출력이 여기서 갈라집니다. */

export interface NoteEvent {
  /** MIDI 번호(21=A0 ~ 108=C8). null 이면 쉼표 */
  midi: number | null;
  /** 곡 시작부터의 위치(박 단위, 4/4에서 1박 = 4분음표) */
  startBeat: number;
  /** 길이(박 단위) */
  durationBeats: number;
  /** 가사 한 음절. 끝이 "-" 이면 다음 음절과 이어지는 단어(예: "hap-" → "py") */
  lyric?: string;
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

/** 셈여림 단계 (여린 → 센) */
export type DynamicLevel = "pp" | "p" | "mp" | "mf" | "f" | "ff";

/**
 * 셈여림 기호. 단계 기호(pp~ff)는 그 박부터 다음 단계 기호 전까지 유지되고,
 * cresc/dim(헤어핀)은 durationBeats 동안 점점 세게/여리게 바뀐다.
 */
export interface DynamicEvent {
  startBeat: number;
  kind: DynamicLevel | "cresc" | "dim";
  /** 헤어핀 길이(박). cresc/dim 에만 쓴다 */
  durationBeats?: number;
}

/**
 * 도돌이표·진행 기호 종류.
 * 마디 시작에 붙는 것: repeatStart, segno, coda
 * 마디 끝에 붙는 것: repeatEnd, fine, toCoda, dc, dcAlFine, dcAlCoda, ds, dsAlFine, dsAlCoda
 */
export type MeasureMarkKind =
  | "repeatStart"
  | "repeatEnd"
  | "segno"
  | "coda"
  | "fine"
  | "toCoda"
  | "dc"
  | "dcAlFine"
  | "dcAlCoda"
  | "ds"
  | "dsAlFine"
  | "dsAlCoda";

export interface MeasureMark {
  /** 0부터 센 마디 번호 */
  measure: number;
  kind: MeasureMarkKind;
}

/** 선택 가능한 박자표. 6/8 은 내부적으로 4분음표 3박(beatsPerMeasure=3)이며 표기·묶음만 다르다 */
export type Meter = "3/4" | "4/4" | "6/8";

export interface Score {
  id: string;
  title: string;
  /** 작곡자 (자유 입력, 없거나 빈 문자열 가능). 예전 데이터는 작곡·편곡을 함께 적었음 */
  composer?: string;
  /** 작사자 */
  lyricist?: string;
  /** 편곡자 */
  arranger?: string;
  /** 악보 머리글(빠르기말 + 작사·작곡·편곡자) 글꼴 id. 값 목록은 lib/music/header-fonts.ts 의 HEADER_FONTS */
  headerFont?: string;
  /** 악보 머리글 글자 크기(px, 10~48). 생략하면 기본 크기 */
  headerFontSize?: number;
  /** 박자표. 생략하면 beatsPerMeasure/4 (3→3/4, 4→4/4). 6/8 만 beatsPerMeasure=3 과 함께 명시한다 */
  meter?: Meter;
  bpm: number;
  beatsPerMeasure: number;
  /** 기본 4분음표 = 1박 */
  beatUnit: 4;
  key: KeyInfo;
  notes: NoteEvent[];
  chords: ChordEvent[];
  /** 셈여림 기호. 생략하면 전체 mf */
  dynamics?: DynamicEvent[];
  /** 도돌이표·진행 기호. 생략하면 처음부터 끝까지 한 번 */
  marks?: MeasureMark[];
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
