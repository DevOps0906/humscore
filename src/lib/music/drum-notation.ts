import { splitForNotation, type NotationPiece } from "./notation";
import type { NoteEvent } from "./types";

export interface DrumVoicePiece extends NotationPiece {
  midis: number[];
  hatChange?: "open" | "closed";
}

export interface DrumVoice {
  voice: 1 | 2;
  stem: "up" | "down";
  pieces: DrumVoicePiece[];
}

/** 손은 위 성부, 킥·페달 하이햇은 아래 성부. 원본 타격·재생 길이는 바꾸지 않는다. */
export function drumNotationVoices(notes: readonly NoteEvent[], beats: number, measures: number): DrumVoice[] {
  const sounding = notes.filter((note): note is NoteEvent & { midi: number } => note.midi !== null);
  const result: DrumVoice[] = [];
  for (const voice of [1, 2] as const) {
    const events = sounding.filter((note) => ([36, 35, 44].includes(note.midi) ? 2 : 1) === voice);
    if (!events.length && (sounding.length || voice === 2)) continue;
    const groups = new Map<number, { midis: number[]; duration: number; hatChange?: "open" | "closed" }>();
    for (const note of events) {
      const start = Math.round(note.startBeat * 4) / 4;
      const group = groups.get(start) ?? { midis: [], duration: 0 };
      if (!group.midis.includes(note.midi)) group.midis.push(note.midi);
      group.duration = Math.max(group.duration, Math.round(note.durationBeats * 4) / 4, 0.25);
      groups.set(start, group);
    }
    const attacks = [...groups].sort(([a], [b]) => a - b);
    let hatOpen = false;
    for (const [, group] of attacks) {
      const nextOpen: boolean = group.midis.includes(46) ? true : group.midis.includes(42) ? false : hatOpen;
      if (nextOpen !== hatOpen) group.hatChange = nextOpen ? "open" : "closed";
      hatOpen = nextOpen;
      // 동일 입력의 XML 순서를 MIDI 번호로 고정한다. 보표 위치는 별도 매핑을 사용한다.
      group.midis.sort((a, b) => a - b);
    }
    const linear = attacks.map(([startBeat, group], index) => ({
      midi: group.midis[0], startBeat,
      durationBeats: Math.min(group.duration, (attacks[index + 1]?.[0] ?? Infinity) - startBeat),
    }));
    result.push({ voice, stem: voice === 1 ? "up" : "down", pieces: splitForNotation(linear, { beatsPerMeasure: beats, measures }).map((piece) => ({
      ...piece,
      midis: piece.source === undefined ? [] : attacks[piece.source][1].midis,
      hatChange: !piece.tieStop && piece.source !== undefined ? attacks[piece.source][1].hatChange : undefined,
    })) });
  }
  return result;
}

/** 쉼표와 박 경계에서 연결을 끊는다. 혼합 8·16분음표는 두 번째 빔에 짧은 갈고리를 둔다. */
export function drumBeamXml(pieces: readonly DrumVoicePiece[], index: number, compound = false): string {
  const current = pieces[index];
  const levels = (piece?: DrumVoicePiece) => !piece || piece.midi === null ? 0 : piece.type === "16th" ? 2 : piece.type === "eighth" ? 1 : 0;
  if (!levels(current)) return "";
  const unit = compound ? 1.5 : 1;
  const group = Math.floor((current.startBeat + 1e-6) / unit);
  const joins = (piece: DrumVoicePiece | undefined, before: boolean) => !!piece && piece.measure === current.measure && Math.floor((piece.startBeat + 1e-6) / unit) === group && Math.abs((before ? piece.startBeat + piece.durationBeats - current.startBeat : current.startBeat + current.durationBeats - piece.startBeat)) < 1e-6;
  const prev = joins(pieces[index - 1], true) ? levels(pieces[index - 1]) : 0;
  const next = joins(pieces[index + 1], false) ? levels(pieces[index + 1]) : 0;
  if (!prev && !next) return "";
  let xml = "";
  for (let level = 1; level <= levels(current); level++) {
    const left = prev >= level;
    const right = next >= level;
    const type = left && right ? "continue" : left ? "end" : right ? "begin" : prev ? "backward hook" : "forward hook";
    xml += `<beam number="${level}">${type}</beam>`;
  }
  return xml;
}
