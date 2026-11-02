// 실녹음 벤치: spike/audio/*.{wav,mp3,m4a} 마다 A(pitchy) · B(basic-pitch + 배음 억제) 결과를 MIDI 로 쓰고,
// 같은 이름의 정답 .mid 가 있으면 프레임 일치율을 계산한다.
// 사용: node audio-bench.mjs [--backend webgl|wasm|cpu] [--dir <폴더>] [--selftest]
//   --selftest : 파일 없이 메모리 합성음(단선율·반주)으로 파이프라인만 검증
// 출력: spike/out/audio/<이름>.A.mid · .B.mid(멜로디) · .Ball.mid(basic-pitch 전체 음) · out/results-audio.jsonl
// 오디오는 저장·전송하지 않는다(브라우저 안 디코딩 → 메모리). 이 폴더·out 은 .gitignore.
import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, appendFileSync } from "node:fs";
import { basename, dirname, extname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PitchDetector } from "pitchy";
import pkg from "@tonejs/midi";
import { launch } from "./browser/harness.mjs";
import { synth, notesToGrid, gridToNotes, bpMelodyGrid, scoreGrid, GRID_SEC } from "./lib.mjs";

const { Midi } = pkg;
const here = dirname(fileURLToPath(import.meta.url));
const argv = process.argv.slice(2);
const opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const backend = opt("--backend", "webgl");
const dir = resolve(opt("--dir", join(here, "audio")));
const selftest = argv.includes("--selftest");
const outDir = join(here, "out", "audio");
mkdirSync(outDir, { recursive: true });

// --- A: offline-pitch.ts + pitch-tracker.ts 와 같은 로직 (창 2048 · hop 10ms · RMS 게이트 0.0015 · clarity ≥ 0.88) ---
const WINDOW = 2048, MIN_RMS = 0.0015, CLARITY = 0.88;
function pitchA(samples, sr) {
  const det = PitchDetector.forFloat32Array(WINDOW);
  det.minVolumeAbsolute = MIN_RMS;
  const hop = Math.max(1, Math.round(sr * GRID_SEC));
  const n = Math.floor((samples.length - WINDOW) / hop) + 1;
  const grid = new Int16Array(Math.ceil(samples.length / sr / GRID_SEC) + 1).fill(-1);
  const buf = new Float32Array(WINDOW);
  for (let k = 0; k < n; k++) {
    const start = k * hop;
    buf.set(samples.subarray(start, start + WINDOW));
    let sum = 0;
    for (let i = 0; i < WINDOW; i++) sum += buf[i] * buf[i];
    if (Math.sqrt(sum / WINDOW) <= MIN_RMS) continue;
    const [f, c] = det.findPitch(buf, sr);
    if (f > 0 && c >= CLARITY) {
      const idx = Math.round((start + WINDOW / 2) / sr / GRID_SEC);
      if (idx < grid.length) grid[idx] = Math.round(69 + 12 * Math.log2(f / 440));
    }
  }
  return grid;
}

function writeMidi(path, notes, getter) {
  const m = new Midi();
  const t = m.addTrack();
  for (const x of notes) { const g = getter(x); if (g.dur > 0.005) t.addNote({ midi: g.midi, time: g.time, duration: g.dur, velocity: g.vel }); }
  writeFileSync(path, Buffer.from(m.toArray()));
}

/** 정답 .mid → 멜로디 음 목록. "melody|멜로디|vocal|보컬" 이름 트랙이 있으면 그것만, 없으면 모든 트랙(프레임별 최고음) */
function readRef(path) {
  const midi = new Midi(readFileSync(path));
  const named = midi.tracks.filter((t) => /melody|멜로디|vocal|보컬|lead/i.test(t.name));
  const tracks = named.length ? named : midi.tracks;
  return { notes: tracks.flatMap((t) => t.notes.map((n) => ({ midi: n.midi, start: n.time, end: n.time + n.duration }))), named: named.length > 0 };
}

const fmt = (v) => (v == null ? "-" : (v * 100).toFixed(1) + "%");
const results = [];

const h = await launch({ gpu: backend === "webgl" });
try {
  const info = await h.call({ type: "init", backend, origin: h.origin }, 60000);
  console.log("B 백엔드:", JSON.stringify(info));
  const b64ToF32 = (b64) => { const b = Buffer.from(b64, "base64"); return new Float32Array(b.buffer, b.byteOffset, b.length / 4); };
  const f32ToB64 = (f) => Buffer.from(f.buffer, f.byteOffset, f.byteLength).toString("base64");

  const items = [];
  if (selftest) {
    for (const [kind, sec] of [["mono", 30], ["mix", 30]]) {
      const a = synth(kind, sec, 44100), b = synth(kind, sec, 22050);
      items.push({ name: `selftest-${kind}-${sec}s`, s44: a.samples, s22: b.samples, ref: { notes: a.truth, named: true } });
    }
  } else {
    const files = existsSync(dir) ? readdirSync(dir).filter((f) => /\.(wav|mp3|m4a)$/i.test(f)).sort() : [];
    if (!files.length) console.log(`오디오 파일이 없습니다: ${dir} (wav·mp3·m4a 를 넣으세요. 정답은 같은 이름 .mid)`);
    for (const f of files) {
      const name = basename(f, extname(f));
      const b64 = readFileSync(join(dir, f)).toString("base64");
      const d44 = await h.page.evaluate(([b, sr]) => window.__decode(b, sr), [b64, 44100]);
      const d22 = await h.page.evaluate(([b, sr]) => window.__decode(b, sr), [b64, 22050]);
      const refPath = join(dir, name + ".mid");
      items.push({ name, s44: b64ToF32(d44.b64), s22: b64ToF32(d22.b64), ref: existsSync(refPath) ? readRef(refPath) : null });
    }
  }

  for (const it of items) {
    const seconds = it.s22.length / 22050;
    const tA = performance.now();
    const gA = pitchA(it.s44, 44100);
    const msA = performance.now() - tA;
    const tB = performance.now();
    const r = await h.page.evaluate((b) => window.__transcribe(b), f32ToB64(it.s22));
    const msB = performance.now() - tB;
    const gBraw = bpMelodyGrid(r.notes, seconds, false);
    const gB = bpMelodyGrid(r.notes, seconds, true);

    writeMidi(join(outDir, it.name + ".A.mid"), gridToNotes(gA), (x) => ({ midi: x.midi, time: x.start, dur: x.end - x.start, vel: 0.8 }));
    writeMidi(join(outDir, it.name + ".B.mid"), gridToNotes(gB), (x) => ({ midi: x.midi, time: x.start, dur: x.end - x.start, vel: 0.8 }));
    writeMidi(join(outDir, it.name + ".Ball.mid"), r.notes, (x) => ({ midi: x.pitchMidi, time: x.startTimeSeconds, dur: x.durationSeconds, vel: Math.min(1, x.amplitude) }));

    const row = { name: it.name, seconds: Math.round(seconds * 10) / 10, aMs: Math.round(msA), bMs: Math.round(msB), bInferMs: Math.round(r.inferMs), bPostMs: Math.round(r.postMs), bNotes: r.notes.length, backend: info.backend, ref: it.ref ? (it.ref.named ? "melody-track" : "top-note") : null };
    if (it.ref) {
      const gRef = notesToGrid(it.ref.notes, seconds);
      Object.assign(row, { A: scoreGrid(gA, gRef, it.ref.notes), Braw: scoreGrid(gBraw, gRef, it.ref.notes), B: scoreGrid(gB, gRef, it.ref.notes) });
    }
    results.push(row);
    appendFileSync(join(here, "out", "results-audio.jsonl"), JSON.stringify(row) + "\n");
  }
} finally {
  await h.close();
}

console.log("\n| 파일 | 길이(초) | A 일치 | B 단순최고음 | B+배음억제 | A 옥타브오류 | B 옥타브오류 | A 시간(ms) | B 시간(ms) | B 음표수 |");
console.log("|---|---|---|---|---|---|---|---|---|---|");
for (const r of results)
  console.log(`| ${r.name} | ${r.seconds} | ${fmt(r.A?.exact)} | ${fmt(r.Braw?.exact)} | ${fmt(r.B?.exact)} | ${fmt(r.A?.octave)} | ${fmt(r.B?.octave)} | ${r.aMs} | ${r.bMs} | ${r.bNotes} |`);
console.log(`\nMIDI 출력: ${outDir}`);
