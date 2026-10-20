import { googleFontHref, type HeaderFont } from "@/lib/music/header-fonts";

export interface Credits {
  lyricist?: string;
  composer?: string;
  arranger?: string;
}

/** "작사 A · 작곡 B · 편곡 C" — 값이 있는 것만, 없으면 빈 문자열 */
export function formatCredits({ lyricist, composer, arranger }: Credits): string {
  const parts: [string, string | undefined][] = [
    ["작사", lyricist],
    ["작곡", composer],
    ["편곡", arranger],
  ];
  return parts
    .map(([label, v]) => [label, v?.trim()] as const)
    .filter(([, v]) => !!v)
    .map(([label, v]) => `${label} ${v}`)
    .join(" · ");
}

/** "Adagio ♩ = 72" */
export function formatTempo(term: string, bpm: number): string {
  return `${term} ♩ = ${Math.round(bpm)}`;
}

/** ensureFontStylesheet 가 필요로 하는 최소 Document 모양 (테스트에서 가짜로 대체 가능) */
export interface StyleDocLike {
  head: { appendChild(node: unknown): unknown } | null;
  getElementById(id: string): unknown;
  createElement(tag: string): { id: string; rel: string; href: string };
}

export function fontLinkId(font: HeaderFont): string {
  return `header-font-${font.id}`;
}

/**
 * 웹 글꼴 스타일시트를 head 에 한 번만 주입. 시스템 글꼴·SSR(doc 없음)·오류는 조용히 false.
 * 새로 주입했을 때만 true.
 */
export function ensureFontStylesheet(
  font: HeaderFont,
  doc: StyleDocLike | undefined = typeof document === "undefined" ? undefined : (document as unknown as StyleDocLike),
): boolean {
  try {
    const href = googleFontHref(font);
    if (!href || !doc || !doc.head) return false;
    const id = fontLinkId(font);
    if (doc.getElementById(id)) return false;
    const link = doc.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = href;
    doc.head.appendChild(link);
    return true;
  } catch {
    return false;
  }
}
