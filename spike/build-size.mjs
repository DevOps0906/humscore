// next build 산출물(.next/static) 크기 합계. 사용: node build-size.mjs <앱 루트> [라벨]  → out/build-<라벨>.json
import { readdirSync, readFileSync, statSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { gzipSync, brotliCompressSync } from "node:zlib";

const root = resolve(process.argv[2] ?? ".");
const label = process.argv[3] ?? "build";
const files = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const p = join(d, n);
    if (statSync(p).isDirectory()) walk(p);
    else if (/\.(js|css)$/.test(n)) files.push(p);
  }
})(join(root, ".next", "static"));

const rows = files.map((p) => {
  const b = readFileSync(p);
  return { file: p.slice(root.length + 1).replaceAll("\\", "/"), raw: b.length, gzip: gzipSync(b).length, brotli: brotliCompressSync(b).length };
});
const sum = (k, f = () => true) => rows.filter(f).reduce((a, r) => a + r[k], 0);
const total = { files: rows.length, raw: sum("raw"), gzip: sum("gzip"), brotli: sum("brotli"), jsRaw: sum("raw", (r) => r.file.endsWith(".js")), jsGzip: sum("gzip", (r) => r.file.endsWith(".js")) };
const top = [...rows].sort((a, b) => b.raw - a.raw).slice(0, 12);
const outDir = join(dirname(fileURLToPath(import.meta.url)), "out");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, `build-${label}.json`), JSON.stringify({ total, rows }, null, 1));
console.log(label, JSON.stringify(total));
for (const r of top) console.log(`  ${(r.raw / 1024).toFixed(0).padStart(6)}KB raw ${(r.gzip / 1024).toFixed(0).padStart(5)}KB gz  ${r.file}`);
