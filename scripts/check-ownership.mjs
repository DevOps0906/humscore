// 부에이전트 작업 후 영역 밖 변경이 있는지 검사 (CLAUDE.md "병렬 작업 충돌 방지 규칙")
// 사용: npm run agents:check -- <에이전트명>[,<에이전트명>...]
// 예:   npm run agents:check -- feature-implementer
//       npm run agents:check -- feature-implementer,tester   (병렬 실행한 경우)
import { execSync } from "node:child_process";

const TEST = [/(^|\/)__tests__\//, /\.test\.tsx?$/];

const OWNERSHIP = {
  "music-logic-coder": [/^src\/lib\/music\/(?!types\.ts$)/, ...TEST],
  "feature-implementer": [
    /^src\/app\//,
    /^src\/proxy\.ts$/,
    /^src\/components\//,
    /^src\/hooks\//,
    /^src\/lib\/(audio|platform|storage)\//,
    /^public\//,
    /^ios\//,
    /^android\//,
    /^supabase\//,
    ...TEST,
  ],
  tester: TEST,
  "code-reviewer": [],
  architect: [],
  "file-finder": [],
};

const arg = process.argv[2];
if (!arg) {
  console.error(`사용법: npm run agents:check -- <에이전트명>\n에이전트: ${Object.keys(OWNERSHIP).join(", ")}`);
  process.exit(2);
}
const agents = arg.split(",").map((s) => s.trim());
const unknown = agents.filter((a) => !(a in OWNERSHIP));
if (unknown.length) {
  console.error(`알 수 없는 에이전트: ${unknown.join(", ")}`);
  process.exit(2);
}
const allowed = agents.flatMap((a) => OWNERSHIP[a]);

const changed = execSync("git status --porcelain=v1 --untracked-files=all", { encoding: "utf8" })
  .split("\n")
  .filter(Boolean)
  .map((line) => line.slice(3).split(" -> ").pop().replace(/^"|"$/g, ""));

const outside = changed.filter((f) => !allowed.some((re) => re.test(f)));

console.log(`변경 파일 ${changed.length}개 (검사 대상: ${agents.join(", ")})`);
for (const f of changed) console.log(`  ${outside.includes(f) ? "✗" : "✓"} ${f}`);
if (outside.length) {
  console.error(`\n영역 밖 변경 ${outside.length}개 — 되돌리거나 담당 에이전트에 재배정하세요.`);
  process.exit(1);
}
console.log("\n영역 밖 변경 없음.");
