import { pitchClassName } from "./frequency";
import type { ChordEvent, KeyInfo } from "./types";

export interface ProgressionPreset {
  id: string;
  name: string;
  /** 장조 기준 로마자, 예: "I – V – vi – IV" */
  roman: string;
  /** 단조 기준 로마자 */
  minorRoman: string;
  description: string;
  /** 패턴 마디 수 */
  length: number;
}

type Step = [offset: number, suffix: string];
const rep = (s: Step, n: number): Step[] => Array.from({ length: n }, () => s);

const PATTERNS: Record<string, { major: Step[]; minor: Step[] }> = {
  pop4: {
    major: [[0, ""], [7, ""], [9, "m"], [5, ""]],
    minor: [[0, "m"], [8, ""], [3, ""], [10, ""]],
  },
  ballad: {
    major: [[9, "m"], [5, ""], [0, ""], [7, ""]],
    minor: [[0, "m"], [5, "m"], [8, ""], [7, ""]],
  },
  fifties: {
    major: [[0, ""], [9, "m"], [5, ""], [7, ""]],
    minor: [[0, "m"], [8, ""], [5, "m"], [7, ""]],
  },
  cadence: {
    major: [[0, ""], [5, ""], [7, ""], [0, ""]],
    minor: [[0, "m"], [5, "m"], [7, ""], [0, "m"]],
  },
  plain: {
    major: [[0, ""], [5, ""], [9, "m"], [7, ""]],
    minor: [[0, "m"], [10, ""], [8, ""], [7, ""]],
  },
  jazz251: {
    major: [[2, "m7"], [7, "7"], [0, "maj7"], [9, "m7"]],
    minor: [[2, "dim"], [7, "7"], [0, "m7"], [8, "maj7"]],
  },
  circle: {
    major: [[0, "maj7"], [9, "m7"], [2, "m7"], [7, "7"]],
    minor: [[0, "m7"], [5, "m7"], [10, "7"], [3, "maj7"]],
  },
  canon: {
    major: [[0, ""], [7, ""], [9, "m"], [4, "m"], [5, ""], [0, ""], [5, ""], [7, ""]],
    minor: [[0, "m"], [7, "m"], [8, ""], [3, ""], [5, "m"], [0, "m"], [5, "m"], [7, ""]],
  },
  blues12: {
    major: [...rep([0, "7"], 4), ...rep([5, "7"], 2), ...rep([0, "7"], 2), [7, "7"], [5, "7"], [0, "7"], [7, "7"]],
    minor: [...rep([0, "m7"], 4), ...rep([5, "m7"], 2), ...rep([0, "m7"], 2), [8, "7"], [7, "7"], [0, "m7"], [7, "7"]],
  },
  rock: {
    major: [[0, ""], [10, ""], [5, ""], [0, ""]],
    minor: [[0, "m"], [10, ""], [8, ""], [10, ""]],
  },
};

export const PROGRESSIONS: readonly ProgressionPreset[] = [
  { id: "pop4", name: "팝 4코드", roman: "I – V – vi – IV", minorRoman: "i – VI – III – VII", description: "가장 널리 쓰이는 밝고 시원한 흐름. 후렴이나 어떤 멜로디에도 무난하게 어울립니다.", length: 4 },
  { id: "ballad", name: "감성 발라드", roman: "vi – IV – I – V", minorRoman: "i – iv – VI – V", description: "마이너로 시작해 서정적으로 풀리는 흐름. 잔잔하고 애틋한 곡에 좋습니다.", length: 4 },
  { id: "fifties", name: "50년대 도왑", roman: "I – vi – IV – V", minorRoman: "i – VI – iv – V", description: "오래된 느낌의 정겨운 순환. 따뜻하고 향수 어린 분위기를 냅니다.", length: 4 },
  { id: "cadence", name: "기본 카덴츠", roman: "I – IV – V – I", minorRoman: "i – iv – V – i", description: "가장 기본적인 마무리 진행. 동요나 찬송처럼 안정적이고 또렷한 곡에 알맞습니다.", length: 4 },
  { id: "plain", name: "밝은 4코드", roman: "I – IV – vi – V", minorRoman: "i – VII – VI – V", description: "경쾌하고 부드럽게 이어지는 흐름. 단조에서는 안달루시안 진행으로 어둡고 정열적입니다.", length: 4 },
  { id: "jazz251", name: "재즈 ii-V-I", roman: "ii – V – I – vi", minorRoman: "iidim – V – i – VI", description: "7th 코드로 세련되게 해결되는 재즈의 기본 흐름. 도회적이고 느긋한 분위기입니다.", length: 4 },
  { id: "circle", name: "서클 진행", roman: "I – vi – ii – V", minorRoman: "i – iv – VII – III", description: "5도씩 내려가며 계속 이어지는 흐름. 풍성하고 부드러운 7th 화성이 특징입니다.", length: 4 },
  { id: "canon", name: "파헬벨 캐논(8마디)", roman: "I – V – vi – iii – IV – I – IV – V", minorRoman: "i – v – VI – III – iv – i – iv – V", description: "여덟 마디로 길게 흘러가는 우아한 진행. 서서히 쌓이는 감동의 곡에 어울립니다.", length: 8 },
  { id: "blues12", name: "12마디 블루스", roman: "I7×4 – IV7×2 – I7×2 – V7 – IV7 – I7 – V7", minorRoman: "i7×4 – iv7×2 – i7×2 – ♭VI7 – V7 – i7 – V7", description: "열두 마디가 한 바퀴를 이루는 블루스 형식. 즉흥 연주와 흥겨운 셔플에 좋습니다.", length: 12 },
  { id: "rock", name: "록(♭VII)", roman: "I – ♭VII – IV – I", minorRoman: "i – VII – VI – VII", description: "♭VII 를 섞어 힘 있게 밀어붙이는 흐름. 시원하고 거친 록 사운드에 어울립니다.", length: 4 },
];

/** 프리셋을 measures 마디만큼 반복해 마디당 코드 1개로 만든다. 알 수 없는 id 는 빈 배열 */
export function buildProgression(id: string, key: KeyInfo, measures: number, beatsPerMeasure: number): ChordEvent[] {
  const pat = PATTERNS[id];
  if (!pat) return [];
  const steps = key.mode === "minor" ? pat.minor : pat.major;
  const flats = key.fifths < 0;
  const out: ChordEvent[] = [];
  for (let m = 0; m < measures; m++) {
    const [off, suffix] = steps[m % steps.length];
    out.push({ startBeat: m * beatsPerMeasure, symbol: pitchClassName(key.tonic + off, flats) + suffix });
  }
  return out;
}
