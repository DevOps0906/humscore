import { getScoreParts, scoreForPart } from "./parts";
import { buildPlaybackPlan } from "./playback-plan";
import { mergeTiedNotes } from "./articulation";
import { Midi } from "@tonejs/midi";
import { buildAccompanimentNotes } from "./accompaniment";
import { chordToMidi, transposeChordSymbol, transposeKey } from "./theory";
import { timeSignatureOf } from "./meter";
import { DYNAMIC_VELOCITY, velocityAt } from "./dynamics";
import { unrollScore } from "./form";
import type { Score } from "./types";
import { GM_INSTRUMENTS, ORCHESTRAL_DRUM_NOTES, type InstrumentId } from "./instrument-catalog";

export { GM_INSTRUMENTS, type InstrumentId } from "./instrument-catalog";

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

/** 15개를 넘는 선율 트랙은 MIDI port 메타 이벤트로 분리한다(10번 채널은 타악기). */
function withMidiPorts(bytes: Uint8Array, ports: readonly number[]): Uint8Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const headerEnd = 8 + view.getUint32(4);
  const chunks: Uint8Array[] = [bytes.slice(0, headerEnd)];
  let position = headerEnd, trackIndex = 0;
  while (position + 8 <= bytes.length) {
    const length = view.getUint32(position + 4);
    const track = bytes.slice(position, position + 8 + length);
    const port = trackIndex++ === 0 ? 0 : ports[trackIndex - 2] ?? 0;
    const expanded = new Uint8Array(track.length + 5);
    expanded.set(track.slice(0, 8));
    new DataView(expanded.buffer).setUint32(4, length + 5);
    expanded.set([0, 0xff, 0x21, 1, port], 8);
    expanded.set(track.slice(8), 13);
    chunks.push(expanded);
    position += 8 + length;
  }
  const output = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) { output.set(chunk, offset); offset += chunk.length; }
  return output;
}

export function scoreToMidi(source: Score, opts: MidiExportOptions = {}): Uint8Array {
  if (source.parts?.length) {
    const combined = new Midi();
    combined.header.setTempo(source.bpm);
    const ts = timeSignatureOf(source);
    combined.header.timeSignatures.push({ ticks: 0, timeSignature: [ts.beats, ts.beatType] });
    combined.header.name = utf8AsLatin1(source.title);
    const plan = buildPlaybackPlan(source);
    let channel = 0;
    const ports: number[] = [];
    getScoreParts(source).forEach((part, index) => {
      const single = scoreForPart(source, part.id);
      const timeline = index === 0 ? plan : plan.parts![index - 1];
      const data = new Midi(scoreToMidi({ ...single, notes: timeline.notes, chords: timeline.chords, dynamics: timeline.dynamics, marks: [] }, { ...opts, melodyInstrument: index === 0 ? opts.melodyInstrument : part.instrument, withChords: part.notation === "piano" && opts.withChords !== false }));
      for (const input of data.tracks) {
        const track = combined.addTrack();
        track.name = utf8AsLatin1(part.instrument) + " " + input.name;
        if (input.channel === 9) { track.channel = 9; ports.push(0); }
        else {
          ports.push(Math.floor(channel / 15));
          track.channel = [0, 1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12, 13, 14, 15][channel++ % 15];
        }
        track.instrument.number = input.instrument.number;
        for (const note of input.notes) track.addNote({ midi: note.midi, time: note.time, duration: note.duration, velocity: note.velocity });
      }
    });
    return withMidiPorts(combined.toArray(), ports);
  }
  const score = unrollScore(source); // 도돌이표·D.C./D.S. 를 펼친 타임라인
  const { melodyInstrument = score.instrument ?? "piano", withChords = score.notation === undefined || score.notation === "piano", chordInstrument = "piano" } = opts;
  const percussionNote = ORCHESTRAL_DRUM_NOTES[melodyInstrument];
  const drums = score.notation === "drums" || score.instrument === "drumKit" || melodyInstrument === "drumKit" || percussionNote !== undefined;
  const midi = new Midi();
  midi.header.setTempo(score.bpm);
  const ts = timeSignatureOf(score);
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [ts.beats, ts.beatType] });
  midi.header.name = utf8AsLatin1(score.title);
  const spb = 60 / score.bpm;
  const tp = drums ? 0 : score.transpose;
  const preferFlats = transposeKey(score.key, tp).fifths < 0;

  const melody = midi.addTrack();
  melody.name = drums ? "Drums" : "Melody";
  melody.channel = drums ? 9 : 0;
  melody.instrument.number = GM_INSTRUMENTS[drums ? "drumKit" : melodyInstrument];
  const hasDynamics = (score.dynamics?.length ?? 0) > 0;
  for (const n of mergeTiedNotes(score.notes)) {
    if (n.midi === null) continue;
    // 셈여림이 없으면 기본 0.85, 있으면 mf 를 0.85 로 두고 비례
    const velocity = hasDynamics ? Math.min(1, (velocityAt(score.dynamics, n.startBeat) / DYNAMIC_VELOCITY.mf) * 0.85) : 0.85;
    melody.addNote({ midi: percussionNote ?? n.midi + tp, time: n.startBeat * spb, duration: n.durationBeats * spb, velocity });
  }

  if (!drums && withChords && score.chords.length) {
    const comp = midi.addTrack();
    comp.name = "Chords";
    comp.channel = 1;
    comp.instrument.number = GM_INSTRUMENTS[chordInstrument];
    if (score.accompaniment?.mode === "arpeggio") {
      const endBeat = score.notes.reduce((end, note) => Math.max(end, note.startBeat + note.durationBeats), 0);
      for (const note of buildAccompanimentNotes(score.chords, score.accompaniment, { endBeat, beatsPerMeasure: score.beatsPerMeasure, transpose: tp })) {
        comp.addNote({ midi: note.midi, time: note.startBeat * spb, duration: note.durationBeats * spb * 0.98, velocity: 0.55 });
      }
    } else score.chords.forEach((c, i) => {
      const end = score.chords[i + 1]?.startBeat ?? c.startBeat + score.beatsPerMeasure;
      const symbol = transposeChordSymbol(c.symbol, tp, preferFlats);
      for (const m of chordToMidi(symbol, 3)) {
        comp.addNote({ midi: m, time: c.startBeat * spb, duration: (end - c.startBeat) * spb * 0.98, velocity: 0.55 });
      }
    });
  }
  return midi.toArray();
}
