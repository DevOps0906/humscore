import { Midi } from "@tonejs/midi";
import { chordToMidi, transposeChordSymbol, transposeKey } from "./theory";
import type { Score } from "./types";

/** GM 악기 번호(0부터). 출력 시 멜로디 악기를 바꿔 "여러 악기의 MIDI"를 만듭니다. */
export const GM_INSTRUMENTS = {
  piano: 0,
  strings: 48,
  flute: 73,
  violin: 40,
  cello: 42,
  trumpet: 56,
  clarinet: 71,
  acousticGuitar: 24,
  choir: 52,
} as const;
export type InstrumentId = keyof typeof GM_INSTRUMENTS;

export interface MidiExportOptions {
  melodyInstrument?: InstrumentId;
  /** 코드 반주 트랙 포함 여부 */
  withChords?: boolean;
  chordInstrument?: InstrumentId;
}

/**
 * midi-file 은 메타 텍스트를 문자당 1바이트(하위 8비트)로 기록하고 길이도 문자 수로 센다.
 * UTF-8 바이트를 문자 하나씩으로 펼친 문자열을 넘기면 파일에 올바른 UTF-8 바이트가 기록된다.
 */
export function utf8AsLatin1(text: string): string {
  let out = "";
  for (const b of new TextEncoder().encode(text)) out += String.fromCharCode(b);
  return out;
}

/** utf8AsLatin1 의 역변환: 1바이트 문자열(MIDI 파서가 돌려주는 형태)을 UTF-8 로 해석 */
export function latin1AsUtf8(text: string): string {
  const bytes = new Uint8Array(text.length);
  for (let i = 0; i < text.length; i++) bytes[i] = text.charCodeAt(i) & 0xff;
  return new TextDecoder().decode(bytes);
}

export function scoreToMidi(score: Score, opts: MidiExportOptions = {}): Uint8Array {
  const { melodyInstrument = "piano", withChords = true, chordInstrument = "piano" } = opts;
  const midi = new Midi();
  midi.header.setTempo(score.bpm);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [score.beatsPerMeasure, 4] });
  midi.header.name = utf8AsLatin1(score.title);
  const spb = 60 / score.bpm;
  const tp = score.transpose;
  const preferFlats = transposeKey(score.key, tp).fifths < 0;

  const melody = midi.addTrack();
  melody.name = "Melody";
  melody.channel = 0;
  melody.instrument.number = GM_INSTRUMENTS[melodyInstrument];
  for (const n of score.notes) {
    if (n.midi === null) continue;
    melody.addNote({ midi: n.midi + tp, time: n.startBeat * spb, duration: n.durationBeats * spb, velocity: 0.85 });
  }

  if (withChords && score.chords.length) {
    const comp = midi.addTrack();
    comp.name = "Chords";
    comp.channel = 1;
    comp.instrument.number = GM_INSTRUMENTS[chordInstrument];
    score.chords.forEach((c, i) => {
      const end = score.chords[i + 1]?.startBeat ?? c.startBeat + score.beatsPerMeasure;
      const symbol = transposeChordSymbol(c.symbol, tp, preferFlats);
      for (const m of chordToMidi(symbol, 3)) {
        comp.addNote({ midi: m, time: c.startBeat * spb, duration: (end - c.startBeat) * spb * 0.98, velocity: 0.55 });
      }
    });
  }
  return midi.toArray();
}
