#!/usr/bin/env node
/**
 * 빌드 결과의 첫 화면(out/index.html)을 메인 랜딩 페이지로 교체 (next build 직후 실행)
 *   npm run build  → next build && node scripts/landing-index.mjs
 *
 * public/index.html 은 app/page.tsx 가 만드는 index.html 과 충돌해 빌드가 실패하므로,
 * 랜딩은 public/tono.html 로 두고 빌드 후 out/index.html 에 덮어씁니다.
 * (개발 서버에서는 app/page.tsx 가 / → /tono.html 로 이동시킵니다.)
 */
import { copyFileSync, existsSync, readFileSync } from "node:fs";

const SRC = "public/tono.html";
const DEST = "out/index.html";

if (!existsSync(SRC)) throw new Error(`${SRC} 이 없습니다`);
if (!existsSync("out")) throw new Error("out/ 이 없습니다 — next build 를 먼저 실행하세요");

copyFileSync(SRC, DEST);
if (!readFileSync(DEST, "utf8").includes("__bundler/template")) throw new Error(`${DEST} 복사 확인 실패`);
console.log(`✓ ${DEST} ← ${SRC}`);
