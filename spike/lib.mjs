// 스파이크 공용(브라우저·Node 겸용): 합성음(메모리 전용), 배음 억제, 10ms 격자 변환, 일치율 계산
export const GRID_SEC = 0.01;
export const HARMONIC_DIFFS = new Set([12, 19, 24, 28, 31, 34, 36]);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const AMPS = [1, 0.5, 0.33, 0.25, 0.2];
function addTone(out, sr, midi, start, dur, gain) {
  const f0 = 440 * 2 ** ((midi - 69) / 12);
  const s0 = Math.floor(start * sr);
  const n = Math.min(out.length - s0, Math.floor(dur * sr));
  const atk = Math.floor(0.01 * sr);
  for (let h = 0; h < AMPS.length; h++) {
    const w = (2 * Math.PI * f0 * (h + 1)) / sr;
    if (f0 * (h + 1) > sr / 2) break;
    for (let i = 0; i < n; i++) {
      const env = Math.min(1, i / atk) * Math.exp(-2.5 * (i / sr) / dur);
      out[s0 + i] += gain * AMPS[h] * env * Math.sin(w * i);
    }
  }
}

/** 합성음(메모리 전용). kind: "mono"(단선율) | "mix"(멜로디 + 3화음 반주 + 베이스). truth = 멜로디 [{midi,start,end}] */
export function synth(kind, seconds, sr, seed = 7) {
  const r = rng(seed);
  const out = new Float32Array(Math.floor(seconds * sr));
  const scale = [60, 62, 64, 67, 69, 72, 74, 76];
  const truth = [];
  let t = 0.2;
  let idx = 3;
  while (t < seconds - 0.6) {
    const dur = 0.25 + Math.floor(r() * 3) * 0.125;
    idx = Math.max(0, Math.min(scale.length - 1, idx + Math.floor(r() * 5) - 2));
    if (r() > 0.12) {
      addTone(out, sr, scale[idx], t, dur, 0.2);
      truth.push({ midi: scale[idx], start: t, end: t + dur });
    }
    t += dur + 0.03;
  }
  if (kind === "mix") {
    const chords = [[48, 52, 55], [53, 57, 60], [55, 59, 62], [48, 52, 55]];
    for (let c = 0, ct = 0; ct < seconds - 0.5; c++, ct += 2) {
      const ch = chords[c % chords.length];
      for (const m of ch) addTone(out, sr, m, ct, 1.9, 0.08);
      addTone(out, sr, ch[0] - 12, ct, 1.9, 0.12);
    }
  }
  let peak = 0;
  for (let i = 0; i < out.length; i++) peak = Math.max(peak, Math.abs(out[i]));
  if (peak > 0.9) for (let i = 0; i < out.length; i++) out[i] *= 0.9 / peak;
  return { samples: out, truth };
}

/** 음 목록 → 10ms 격자 (없으면 -1). 같은 프레임 여러 음이면 가장 높은 값 */
export function notesToGrid(notes, seconds) {
  const n = Math.ceil(seconds / GRID_SEC) + 1;
  const g = new Int16Array(n).fill(-1);
  for (const x of notes) {
    const a = Math.max(0, Math.round(x.start / GRID_SEC));
    const b = Math.min(n, Math.round(x.end / GRID_SEC));
    for (let i = a; i < b; i++) if (x.midi > g[i]) g[i] = x.midi;
  }
  return g;
}

/** 격자 → 음 목록 (같은 높이 연속 프레임, minFrames 미만 제거) */
export function gridToNotes(grid, minFrames = 3) {
  const notes = [];
  for (let i = 0; i < grid.length; ) {
    if (grid[i] < 0) { i++; continue; }
    let j = i;
    while (j < grid.length && grid[j] === grid[i]) j++;
    if (j - i >= minFrames) notes.push({ midi: grid[i], start: i * GRID_SEC, end: j * GRID_SEC });
    i = j;
  }
  return notes;
}

/**
 * basic-pitch 음(noteFramesToTime 결과) → 프레임별 최고음 + 배음 억제.
 * 억제: 같은 프레임에 더 낮고 세기(amplitude)가 같거나 큰 음과 12·19·24·28·31·34·36반음 차이면 제외.
 * suppress=false면 단순 최고음.
 */
export function bpMelodyGrid(bpNotes, seconds, suppress = true) {
  const n = Math.ceil(seconds / GRID_SEC) + 1;
  const active = Array.from({ length: n }, () => []);
  for (const x of bpNotes) {
    const a = Math.max(0, Math.round(x.startTimeSeconds / GRID_SEC));
    const b = Math.min(n, Math.round((x.startTimeSeconds + x.durationSeconds) / GRID_SEC));
    for (let i = a; i < b; i++) active[i].push(x);
  }
  const g = new Int16Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    let best = -1;
    for (const x of active[i]) {
      if (x.pitchMidi <= best) continue;
      if (suppress) {
        let drop = false;
        for (const y of active[i]) {
          if (y.pitchMidi < x.pitchMidi && HARMONIC_DIFFS.has(x.pitchMidi - y.pitchMidi) && y.amplitude >= x.amplitude) { drop = true; break; }
        }
        if (drop) continue;
      }
      best = x.pitchMidi;
    }
    g[i] = best;
  }
  return g;
}

/** 일치율: 정답 음이 울리는 프레임 중 시스템이 같은 MIDI를 낸 비율 (정답 음 경계 ±20ms 제외). 옥타브 오류 = 음이름은 같고 옥타브만 다름 */
export function scoreGrid(sys, ref, refNotes) {
  const n = ref.length;
  const excl = new Uint8Array(n);
  for (const x of refNotes) {
    for (const t of [x.start, x.end]) {
      const c = Math.round(t / GRID_SEC);
      for (let i = Math.max(0, c - 2); i <= Math.min(n - 1, c + 2); i++) excl[i] = 1;
    }
  }
  let frames = 0, exact = 0, oct = 0;
  for (let i = 0; i < n; i++) {
    if (ref[i] < 0 || excl[i]) continue;
    frames++;
    const s = i < sys.length ? sys[i] : -1;
    if (s === ref[i]) exact++;
    else if (s >= 0 && s % 12 === ref[i] % 12) oct++;
  }
  return { frames, exact: frames ? exact / frames : null, octave: frames ? oct / frames : null };
}
