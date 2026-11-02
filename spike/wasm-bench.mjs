// wasm 백엔드(tfjs-backend-wasm 3.21) Chromium 워커 처리 시간. 사용: node wasm-bench.mjs [wasm|wasm-coi|webgl|cpu ...]
// wasm = 스레드 없음(crossOriginIsolated 아님) / wasm-coi = COOP/COEP 로 스레드 가능 환경. 결과는 out/results-wasm.jsonl 에 추가.
import { appendFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { launch } from "./browser/harness.mjs";

const out = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(out, { recursive: true });
const configs = process.argv.slice(2).length ? process.argv.slice(2) : ["wasm", "wasm-coi"];
const runs = [["mix", 30, "cold"], ["mix", 30, "warm"], ["mix", 30, "warm2"], ["mix", 180, "warm"], ["mix", 180, "warm2"]];

for (const cfg of configs) {
  const backend = cfg.startsWith("wasm") ? "wasm" : cfg;
  const h = await launch({ coi: cfg === "wasm-coi", gpu: backend === "webgl" });
  try {
    const info = await h.call({ type: "init", backend, origin: h.origin }, 60000);
    console.log(cfg, JSON.stringify(info));
    appendFileSync(join(out, "results-wasm.jsonl"), JSON.stringify({ cfg, info }) + "\n");
    for (const [kind, seconds, phase] of runs) {
      const r = await h.call({ type: "synth", kind, seconds });
      const row = { cfg, kind, seconds, phase, backend: info.backend, ...Object.fromEntries(Object.entries(r).map(([k, v]) => [k, typeof v === "number" ? Math.round(v) : v])) };
      console.log(JSON.stringify(row));
      appendFileSync(join(out, "results-wasm.jsonl"), JSON.stringify(row) + "\n");
    }
    // wasm 스레드 워커는 blob: URL(네트워크 아님)로 요청 목록에 http://.../uuid 로 잡힌다 → 제외
    const other = [...new Set(h.requests)].filter((p) => !/^\/(worker\.js|model\/.*|wasm\/.*)?$/.test(p) && !p.startsWith("http"));
    console.log(cfg, "requests", [...new Set(h.requests)].join(" "), "| 기타:", other.length);
  } catch (e) {
    console.log(cfg, "FAIL", String(e.message).slice(0, 1500));
    appendFileSync(join(out, "results-wasm.jsonl"), JSON.stringify({ cfg, error: String(e.message).slice(0, 400) }) + "\n");
  } finally {
    await h.close();
  }
}
