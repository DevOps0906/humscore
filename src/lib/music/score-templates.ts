import { createBlankScore } from "./edit";
import { instrumentMode, ORCHESTRAL_DRUM_NOTES, type InstrumentId } from "./instrument-catalog";
import { beatsPerMeasureOf } from "./meter";
import { fifthsFor } from "./theory";
import type { Meter, NoteEvent, Score, ScorePart } from "./types";

export const SCORE_TEMPLATES = [
  { id: "ccm", title: "CCM 리드 시트", detail: "코드·선율·가사와 절 구분", instruments: ["choir", "piano", "bassGuitar", "drumKit"], bpm: 84, meter: "4/4", reference: "CCM 이미지와 제공 PDF의 코드·가사 배치" },
  { id: "hymn", title: "찬송가", detail: "3박 선율과 피아노 분산 반주", instruments: ["choir", "piano"], bpm: 76, meter: "3/4", reference: "찬송가 이미지의 절별 가사와 피아노 이미지의 양손 보표" },
  { id: "piano", title: "피아노 악보", detail: "높은·낮은음자리표와 붙임줄·이음줄", instruments: ["piano"], bpm: 80, meter: "3/4", reference: "피아노 이미지의 양손 구성과 프레이즈" },
  { id: "guitar", title: "기타 악보", detail: "선율·코드와 기타 TAB", instruments: ["acousticGuitar"], bpm: 100, meter: "4/4", reference: "제공 PDF의 코드 진행과 리듬 표기" },
  { id: "drums", title: "드럼 악보", detail: "킥·스네어·하이햇과 마디 끝 필인", instruments: ["drumKit"], bpm: 110, meter: "4/4", reference: "드럼 템플릿과 드럼 악보의 X형 심벌·독립 성부" },
  { id: "bass", title: "베이스 악보", detail: "낮은음자리표·근음 진행과 베이스 TAB", instruments: ["bassGuitar"], bpm: 96, meter: "4/4", reference: "베이스 이미지의 낮은음자리표·TAB·리듬 구성" },
  { id: "band", title: "밴드 스코어", detail: "보컬·피아노·기타·베이스·드럼 독립 파트", instruments: ["choir", "piano", "electricGuitar", "bassGuitar", "drumKit"], bpm: 104, meter: "4/4", reference: "CCM·기타 PDF·베이스·드럼 자료의 합주 구성" },
  { id: "orchestra", title: "오케스트라 · 관현악", detail: "목관·금관·현악·타악을 악기별로 배치", instruments: ["flute", "oboe", "clarinet", "bassoon", "frenchHorn", "trumpet", "trombone", "tuba", "violin", "violinII", "viola", "cello", "doubleBass", "timpani", "orchestralCymbal"], bpm: 96, meter: "4/4", reference: "관현악 이미지의 악기 순서와 악기별 음자리표" },
] as const satisfies readonly { id: string; title: string; detail: string; instruments: readonly InstrumentId[]; bpm: number; meter: Meter; reference: string }[];

export type ScoreTemplateId = typeof SCORE_TEMPLATES[number]["id"];
export interface TemplateOptions {
  template: ScoreTemplateId;
  instruments: InstrumentId[];
  title: string;
  bpm: number;
  meter: Meter;
  measures: number;
  tonic: number;
}

/** 제공 자료의 편성과 표기 구조를 기초로 만든 편집 가능한 시작 악보. */
export function buildScoreTemplate(options: TemplateOptions): Score {
  const preset = SCORE_TEMPLATES.find((template) => template.id === options.template) ?? SCORE_TEMPLATES[0];
  const beats = beatsPerMeasureOf(options.meter);
  const measures = Math.min(32, Math.max(4, Math.round(options.measures)));
  const tonic = ((Math.round(options.tonic) % 12) + 12) % 12;
  const intervals = [0, 7, 9, 5, 0, 5, 7, 0];
  const symbols = ["C", "G", "Am", "F", "C", "F", "G7", "C"];
  const names = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  const chords = Array.from({ length: measures }, (_, m) => {
    const original = symbols[m % 8];
    const pc = [0, 7, 9, 5, 0, 5, 7, 0][m % 8];
    return { startBeat: m * beats, symbol: names[(pc + tonic) % 12] + (original.endsWith("m") ? "m" : original.endsWith("7") ? "7" : "") };
  });
  const selected = [...new Set(options.instruments)].slice(0, 32);
  if (!selected.length) selected.push(preset.instruments[0]);
  const parts: ScorePart[] = selected.map((instrument, index) => {
    const notes: NoteEvent[] = [];
    const bass = ["bassGuitar", "bassGuitar5", "doubleBass", "cello", "bassoon", "tuba", "trombone", "bassTrombone", "synthBass"].includes(instrument);
    const percussion = instrumentMode(instrument) === "drums" || ["orchestralSnare", "orchestralBassDrum", "orchestralCymbal", "triangle"].includes(instrument);
    for (let m = 0; m < measures; m++) {
      const start = m * beats;
      const root = (bass ? instrument === "bassGuitar5" ? 28 : 36 : instrument === "viola" || instrument === "frenchHorn" ? 48 : 60) + tonic + intervals[m % 8];
      if (percussion && instrument !== "drumKit") {
        notes.push({ midi: ORCHESTRAL_DRUM_NOTES[instrument] ?? 38, startBeat: start, durationBeats: 1 });
      } else if (percussion) {
        for (let step = 0; step < beats * 2; step++) {
          const at = start + step / 2;
          notes.push({ midi: 42, startBeat: at, durationBeats: 0.5 });
          if (step % 4 === 0) notes.push({ midi: 36, startBeat: at, durationBeats: 0.5 });
          if (step % 4 === 2) notes.push({ midi: 38, startBeat: at, durationBeats: 0.5 });
          if (m % 4 === 3 && step >= beats * 2 - 2) notes.push({ midi: step % 2 ? 43 : 50, startBeat: at, durationBeats: 0.5 });
        }
      } else if (bass) {
        for (let beat = 0; beat < beats; beat++) notes.push({ midi: root + (beat === beats - 1 && m % 2 === 1 ? 7 : 0), startBeat: start + beat, durationBeats: 1 });
      } else {
        const pattern = m % 2 ? [4, 2, 0, 7, 4, 2, 0, 0] : [0, 0, 4, 7, 9, 7, 4, 2];
        for (let step = 0; step < beats * 2; step++) notes.push({ midi: root + pattern[step % pattern.length], startBeat: start + step / 2, durationBeats: 0.5,
          ...(step === 0 && m % 2 === 0 ? { tieToNext: true } : {}),
          ...(step === 2 ? { slurToNext: true } : {}),
        });
      }
    }
    notes.sort((a, b) => a.startBeat - b.startBeat || (a.midi ?? 0) - (b.midi ?? 0));
    if (instrument === "choir") {
      const syllables = ["새", "로", "운", "노", "래", "를", "함", "께"];
      notes.forEach((note, i) => { if (!notes[i - 1]?.tieToNext) note.lyric = syllables[i % syllables.length]; });
    }
    return { id: `template-${index}`, instrument, notation: instrumentMode(instrument), notes, chords: percussion ? [] : chords.map((chord) => ({ ...chord })),
      ...(instrumentMode(instrument) === "piano" ? { accompaniment: { mode: "arpeggio" as const, pattern: options.meter === "3/4" ? "waltz" : "alberti" } } : {}),
    };
  });
  const [first, ...additional] = parts;
  return { ...createBlankScore(), ...first, id: createBlankScore().id, title: options.title.trim() || preset.title, bpm: Math.min(240, Math.max(30, options.bpm)), meter: options.meter,
    beatsPerMeasure: beats, key: { tonic, mode: "major", fifths: fifthsFor(tonic, "major") }, parts: additional.length ? additional : undefined };
}
