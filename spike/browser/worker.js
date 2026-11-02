import "./shim.js";
import * as tf from "@tensorflow/tfjs";
import { setWasmPaths } from "@tensorflow/tfjs-backend-wasm";
import { BasicPitch, outputToNotesPoly, noteFramesToTime } from "@spotify/basic-pitch";
import { synth } from "../lib.mjs";

let bp = null;
let modelUrl = "";

// tfjs-backend-wasm 3.21 의 Fill 커널은 attrs.dtype 이 undefined 면 "Unknown dtype undefined" 로 죽는다(모델 실행 중 발생).
// 우회: dtype 이 없으면 값 종류로 추정하도록 wasm 'Fill' 커널을 덮어쓴다. --nofill-fix 로 끄고 원래 실패를 재현할 수 있다.
function patchWasmFill() {
  tf.registerKernel({
    kernelName: "Fill",
    backendName: "wasm",
    kernelFunc: ({ backend, attrs }) => {
      const { shape, value } = attrs;
      const dtype = attrs.dtype ?? (typeof value === "string" ? "string" : "float32");
      const out = backend.makeOutput(shape, dtype);
      backend.typedArrayFromHeap(out).fill(value);
      return out;
    },
  });
}

async function init({ backend, origin, fillFix = true }) {
  modelUrl = origin + "/model/model.json";
  setWasmPaths(origin + "/wasm/");
  if (backend === "wasm" && fillFix) {
    tf.unregisterKernel("Fill", "wasm");
    patchWasmFill();
  }
  const ok = await tf.setBackend(backend);
  await tf.ready();
  return { requested: backend, setOk: ok, backend: tf.getBackend(), coi: self.crossOriginIsolated, cores: navigator.hardwareConcurrency };
}

async function run(samples22k) {
  const t0 = performance.now();
  if (!bp) bp = new BasicPitch(modelUrl);
  await bp.model; // 모델 로드(첫 호출만 시간 걸림)
  const tModel = performance.now();
  // onComplete 가 배치마다 불리면 이어 붙여야 전체 길이가 된다
  const frames = [], onsets = [];
  let calls = 0;
  await bp.evaluateModel(samples22k, (f, o) => { calls++; for (const r of f) frames.push(r); for (const r of o) onsets.push(r); }, () => {});
  const tInfer = performance.now();
  const notes = noteFramesToTime(outputToNotesPoly(frames, onsets, 0.25, 0.25, 5));
  const tPost = performance.now();
  return {
    notes,
    calls,
    frameRows: frames.length,
    modelMs: tModel - t0,
    inferMs: tInfer - tModel,
    postMs: tPost - tInfer,
    totalMs: tPost - t0,
  };
}

self.onmessage = async (e) => {
  const m = e.data;
  try {
    if (m.type === "init") self.postMessage({ id: m.id, ok: await init(m) });
    else if (m.type === "synth") {
      const { samples } = synth(m.kind, m.seconds, 22050);
      const r = await run(samples);
      self.postMessage({ id: m.id, ok: { ...r, notes: r.notes.length } });
    } else if (m.type === "transcribe") {
      self.postMessage({ id: m.id, ok: await run(m.samples) });
    }
  } catch (err) {
    self.postMessage({ id: m.id, error: String(err && err.stack ? err.stack : err) });
  }
};
self.onerror = (ev) => self.postMessage({ id: -1, error: "onerror " + ev.message });
