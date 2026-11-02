// 어떤 서버 산출물(HTML·RSC·manifest)이 해당 청크 이름을 참조하는지. 사용: node chunk-users.mjs <앱 루트> <청크 파일명 일부>
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";

const root = resolve(process.argv[2]);
const needle = process.argv[3];
const hits = [];
(function walk(d) {
  for (const n of readdirSync(d)) {
    const f = join(d, n);
    if (statSync(f).isDirectory()) walk(f);
    else if (/\.(html|rsc|body|json|js)$/.test(n) && readFileSync(f, "utf8").includes(needle)) hits.push(f.slice(root.length + 1).replaceAll("\\", "/"));
  }
})(join(root, ".next", "server"));
console.log(hits.join("\n") || "(없음)");
