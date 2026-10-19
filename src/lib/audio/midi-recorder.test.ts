import { describe, expect, it } from "vitest";
import { midiEventsToRawNotes } from "./midi-recorder";
import type { MidiEvent } from "./midi-input";

const on = (midi: number, time: number): MidiEvent => ({ type: "on", midi, velocity: 0.8, time });
const off = (midi: number, time: number): MidiEvent => ({ type: "off", midi, time });

describe("midiEventsToRawNotes", () => {
  it("converts on/off into seconds relative to start", () => {
    const r = midiEventsToRawNotes([on(60, 1500), off(60, 2000)], 1000);
    expect(r).toEqual([{ midi: 60, startSec: 0.5, endSec: 1, meanCents: 0 }]);
  });

  it("ends a held note when a new note-on arrives (legato)", () => {
    const r = midiEventsToRawNotes([on(60, 1000), on(62, 1500), off(60, 1600), off(62, 2000)], 1000);
    expect(r.map((n) => [n.midi, n.startSec, n.endSec])).toEqual([
      [60, 0, 0.5],
      [62, 0.5, 1],
    ]);
  });

  it("ends held notes at stop time and ignores pedal", () => {
    const r = midiEventsToRawNotes([on(64, 1000), { type: "pedal", down: true, time: 1200 }], 1000, 2500);
    expect(r).toEqual([{ midi: 64, startSec: 0, endSec: 1.5, meanCents: 0 }]);
  });

  it("clamps count-in presses and drops notes entirely before start", () => {
    const r = midiEventsToRawNotes([on(60, 500), off(60, 800), on(62, 900), off(62, 1500)], 1000);
    expect(r.map((n) => [n.midi, n.startSec, n.endSec])).toEqual([[62, 0, 0.5]]);
  });
});
