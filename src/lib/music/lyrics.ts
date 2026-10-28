import type { NoteEvent } from "./types";

/**
 * 음표별 가사.
 * 음절 문자열 규칙: 끝이 "-" 이면 같은 단어의 다음 음절로 이어짐(예: "hap-", "py").
 * 한글은 글자(음절) 하나가 음표 하나, 라틴 문자는 단어 하나가 음표 하나(하이픈이 있으면 음절로 나눔).
 */

/** "auto": 한글은 글자 단위·그 밖은 단어 단위 / "ko": 같음 / "latin": 한글도 단어 단위 */
export type LyricLang = "auto" | "ko" | "latin";

export type Syllabic = "single" | "begin" | "middle" | "end";

const HANGUL = /[ᄀ-ᇿ㄰-㆏가-힣]/u;
/** 글자·숫자·결합 부호·아포스트로피·하이픈 외 문장부호는 공백으로 */
const PUNCT = /[^\p{L}\p{N}\p{M}'’-]+/gu;

export function splitLyrics(text: string, lang: LyricLang = "auto"): string[] {
  const out: string[] = [];
  for (const token of text.replace(PUNCT, " ").split(/\s+/)) {
    const parts = token.split(/-+/).filter((p) => p.replace(/['’]/g, "") !== "");
    if (parts.length === 0) continue;
    if (lang !== "latin" && parts.some((p) => HANGUL.test(p))) {
      // 한글 섞인 토큰: 한글은 글자마다, 붙은 비한글 문자열은 한 덩어리로
      for (const p of parts) for (const m of p.match(/[ᄀ-ᇿ㄰-㆏가-힣]|[^ᄀ-ᇿ㄰-㆏가-힣]+/gu) ?? []) out.push(m);
      continue;
    }
    parts.forEach((p, i) => out.push(i < parts.length - 1 ? `${p}-` : p));
  }
  return out;
}

export interface ApplyLyricsResult {
  notes: NoteEvent[];
  /** 배정할 음표가 모자라 남은 음절 */
  rest: string[];
}

/** fromIndex 번째 음표부터 쉼표를 건너뛰며 음절을 하나씩 배정. 원본 배열·음표는 바꾸지 않음 */
export function applyLyrics(notes: NoteEvent[], syllables: string[], fromIndex = 0): ApplyLyricsResult {
  let k = 0;
  const out = notes.map((n, i) => {
    if (i < fromIndex || n.midi === null || k >= syllables.length) return n;
    return { ...n, lyric: syllables[k++] };
  });
  return { notes: out, rest: syllables.slice(k) };
}

/** 가사 음절 목록 → MusicXML syllabic. 이전 음절이 "-" 로 끝났는지와 자신이 "-" 로 끝나는지로 결정 */
export function syllabicOf(prev: string | undefined, cur: string): Syllabic {
  const cont = prev !== undefined && prev.endsWith("-");
  const open = cur.endsWith("-");
  return cont ? (open ? "middle" : "end") : open ? "begin" : "single";
}

/** 출력용 음절 텍스트(이어짐 표시 "-" 제거) */
export const lyricText = (s: string) => s.replace(/-+$/, "");
