import { describe, expect, it } from "vitest";
import { parseMidiMessage } from "./midi-input";

describe("parseMidiMessage", () => {
  it("note-on", () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 127]))).toEqual({ type: "on", midi: 60, velocity: 1 });
  });
  it("accepts any channel", () => {
    expect(parseMidiMessage(new Uint8Array([0x95, 72, 64]))).toMatchObject({ type: "on", midi: 72 });
  });
  it("note-on with velocity 0 is note-off", () => {
    expect(parseMidiMessage(new Uint8Array([0x90, 60, 0]))).toEqual({ type: "off", midi: 60 });
  });
  it("note-off", () => {
    expect(parseMidiMessage(new Uint8Array([0x80, 61, 40]))).toEqual({ type: "off", midi: 61 });
  });
  it("sustain pedal", () => {
    expect(parseMidiMessage(new Uint8Array([0xb0, 64, 127]))).toEqual({ type: "pedal", down: true });
    expect(parseMidiMessage(new Uint8Array([0xb0, 64, 63]))).toEqual({ type: "pedal", down: false });
    expect(parseMidiMessage(new Uint8Array([0xb0, 64, 64]))).toEqual({ type: "pedal", down: true });
  });
  it("ignores other messages", () => {
    expect(parseMidiMessage(new Uint8Array([0xb0, 7, 100]))).toBeNull();
    expect(parseMidiMessage(new Uint8Array([0xf8]))).toBeNull();
    expect(parseMidiMessage(new Uint8Array([0xe0, 0, 64]))).toBeNull();
    expect(parseMidiMessage(new Uint8Array([]))).toBeNull();
  });
});
