// 디코딩·정답 .mid 읽기 경로 점검(파일 생성 없음): 메모리 WAV → 브라우저 OfflineAudioContext 22.05k/44.1k 디코딩, out/audio/*.mid 읽기
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pkg from "@tonejs/midi";
import { launch } from "./browser/harness.mjs";
import { synth } from "./lib.mjs";

const here = dirname(fileURLToPath(import.meta.url));
const sr = 32000; // 일부러 앱 기준(44.1k)과 다른 원본 레이트
const { samples } = synth("mono", 5, sr);
const wav = Buffer.alloc(44 + samples.length * 2);
wav.write("RIFF", 0); wav.writeUInt32LE(36 + samples.length * 2, 4); wav.write("WAVEfmt ", 8);
wav.writeUInt32LE(16, 16); wav.writeUInt16LE(1, 20); wav.writeUInt16LE(1, 22); wav.writeUInt32LE(sr, 24);
wav.writeUInt32LE(sr * 2, 28); wav.writeUInt16LE(2, 32); wav.writeUInt16LE(16, 34); wav.write("data", 36); wav.writeUInt32LE(samples.length * 2, 40);
samples.forEach((v, i) => wav.writeInt16LE(Math.round(v * 32767), 44 + i * 2));
const h = await launch();
try {
  for (const target of [44100, 22050]) {
    const d = await h.page.evaluate(([b, s]) => window.__decode(b, s), [wav.toString("base64"), target]);
    console.log(`WAV ${sr}Hz 5s → 디코딩 ${target}: sr=${d.sr} 샘플=${Buffer.from(d.b64, "base64").length / 4} (기대 ${5 * target})`);
  }
  console.log("AAC(m4a) 디코딩 지원:", await h.page.evaluate(() => document.createElement("audio").canPlayType('audio/mp4; codecs="mp4a.40.2"') || "no"), "· mp3:", await h.page.evaluate(() => document.createElement("audio").canPlayType("audio/mpeg") || "no"));
} finally {
  await h.close();
}
const dir = join(here, "out", "audio");
if (existsSync(dir)) for (const f of readdirSync(dir).filter((x) => x.endsWith(".mid")).slice(0, 3)) {
  const m = new pkg.Midi(readFileSync(join(dir, f)));
  console.log(f, "트랙", m.tracks.length, "음", m.tracks[0].notes.length);
}
