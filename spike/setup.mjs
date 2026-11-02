// 모델·wasm 파일을 패키지에서 spike/model, spike/browser/wasm 으로 복사하고 워커를 번들한다 (npm run setup)
import { cpSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { build } from "esbuild";

const here = dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);

const bpDir = dirname(require.resolve("@spotify/basic-pitch/package.json"));
cpSync(join(bpDir, "model"), join(here, "model"), { recursive: true });

const wasmMain = require.resolve("@tensorflow/tfjs-backend-wasm");
let wasmDir = dirname(wasmMain);
if (!readdirSync(wasmDir).some((f) => f.endsWith(".wasm"))) wasmDir = join(dirname(wasmDir), "dist");
mkdirSync(join(here, "browser", "wasm"), { recursive: true });
for (const f of readdirSync(wasmDir)) {
  if (f.endsWith(".wasm") || /threaded.*\.(js|worker\.js)$/.test(f) || f.endsWith(".worker.js")) cpSync(join(wasmDir, f), join(here, "browser", "wasm", f));
}
mkdirSync(join(here, "out"), { recursive: true });
await build({
  entryPoints: [join(here, "browser", "worker.js")],
  outfile: join(here, "out", "worker.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  minify: !process.argv.includes("--dev"),
  logLevel: "warning",
  define: { "process.env.NODE_ENV": '"production"' },
});
console.log("model:", existsSync(join(here, "model", "model.json")), "wasm:", readdirSync(join(here, "browser", "wasm")).join(","));
