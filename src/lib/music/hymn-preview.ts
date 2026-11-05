import type { NoteEvent, ScorePart } from "./types";

/**
 * 전통 스웨덴 선율 O store Gud의 확인 가능한 첫 구절을 바탕으로 만든 8마디 예시.
 * https://piano.org/songs/hymns/how-great-thou-art/ 의 1894년 판본 설명:
 * B♭장조의 첫 음열 F4 F4 F4 D4 F4 F4 F4 G4 G4를 C장조로 옮겼다.
 * 아래 리듬·이어지는 구절·SATB 화성·가사는 미리보기용으로 새로 구성한 것으로,
 * 현대 How Great Thou Art 편곡이나 한국어 번역 가사의 완곡 전사가 아니다.
 */
const MELODY = [
  [67, 67, 67, 64],
  [67, 67, 67, 69],
  [69, 67, 64, 67],
  [65, 64, 62, 62],
  [67, 67, 72, 71],
  [69, 69, 67, 65],
  [64, 65, 67, 62],
  [64, 62, 60, 60],
] as const;

const CHORD_TONES = [[0, 4, 7], [5, 9, 0], [0, 4, 7], [7, 11, 2], [0, 4, 7], [5, 9, 0], [7, 11, 2], [0, 4, 7]] as const;

// 첫 줄은 사용자가 제시한 제목. 2~4절은 절별 배치를 보여 주기 위해 새로 쓴 예시다.
const VERSE_SYLLABLES = [
  Array.from("주 하나님 지으신 모든 세계 온 땅에 빛이 가득 퍼져가네 맑은 하늘 바라보며 노래해".replaceAll(" ", "")),
  Array.from("푸른 숲에 아침 햇살 내려 작은 새들 바람 따라 노래해 오늘 하루 새로 주신 기쁨을".replaceAll(" ", "")),
  Array.from("깊은 밤에 별빛 길을 비춰 지친 마음 평안으로 쉬게 해 작은 소망 다시 품고 걸어가".replaceAll(" ", "")),
  Array.from("함께 모여 감사 노래 불러 서로 손을 잡고 밝게 나아가 우리 삶에 선한 열매 맺도록".replaceAll(" ", "")),
] as const;

const VOICES = [
  { id: "soprano", name: "소프라노", clef: "treble", low: 60, high: 79, target: 67 },
  { id: "alto", name: "알토", clef: "treble", low: 53, high: 69, target: 60 },
  { id: "tenor", name: "테너", clef: "bass", low: 48, high: 64, target: 55 },
  { id: "bass", name: "베이스", clef: "bass", low: 36, high: 59, target: 43 },
] as const;

/** 성부 교차 없이 주어진 화음 안에서 직전 음과 가까운 높이를 택한다. */
function innerPitch(tones: readonly number[], low: number, high: number, previous: number): number {
  const candidates = Array.from({ length: high - low + 1 }, (_, index) => low + index).filter((midi) => tones.includes(midi % 12));
  return candidates.reduce((best, midi) => Math.abs(midi - previous) < Math.abs(best - previous) ? midi : best, candidates[0] ?? low);
}

/** 합창 음색 한 개로도 SATB 파트·음역·음자리표·절별 가사는 각각 독립 보관한다. */
export function hymnVoiceParts({ measures, beats, tonic, previewSample }: { measures: number; beats: number; tonic: number; previewSample?: boolean }): ScorePart[] {
  const voiceNotes: NoteEvent[][] = VOICES.map(() => []);
  const previous = VOICES.map((voice) => voice.target as number);
  if (previewSample) for (let measure = 0; measure < measures; measure++) {
    const melody = MELODY[measure % MELODY.length];
    const tones = CHORD_TONES[measure % CHORD_TONES.length];
    for (let beat = 0; beat < melody.length; beat++) {
      let above: number = melody[beat];
      VOICES.forEach((voice, voiceIndex) => {
        const pitch = voiceIndex === 0 ? above : innerPitch(tones, voice.low, Math.min(voice.high, above - 1), previous[voiceIndex]);
        previous[voiceIndex] = pitch;
        above = pitch;
        const index = measure * 4 + beat;
        const lyrics = voiceIndex === 0 ? Object.fromEntries(VERSE_SYLLABLES.map((syllables, verse) => [String(verse + 1), syllables[index % 32] ?? ""]).filter(([, text]) => text)) : undefined;
        voiceNotes[voiceIndex].push({ midi: pitch + tonic, startBeat: measure * beats + beat * beats / 4, durationBeats: beats / 4,
          ...(lyrics ? { lyrics, lyric: lyrics["1"] } : {}),
        });
      });
    }
  }
  return VOICES.map((voice, index) => ({ id: `hymn-${voice.id}`, instrument: "choir", notation: "orchestra", partName: voice.name, clef: voice.clef, notes: voiceNotes[index], chords: [] }));
}
