/**
 * 악보 머리글(빠르기말 + 작사·작곡·편곡자 + 제목) 글꼴 목록.
 * Score.headerFont 에는 id 만 저장한다. 웹 글꼴(google 필드가 있는 것)은 선택했을 때만
 * Google Fonts 스타일시트를 불러오고, 불러오기 전/실패 시 stack 의 대체 글꼴로 보인다.
 */

export interface HeaderFont {
  id: string;
  /** 선택 목록에 보이는 이름 */
  label: string;
  /** CSS font-family 값 (대체 글꼴 포함) */
  stack: string;
  /** Google Fonts css2 의 family 쿼리 값 (예: "Nanum+Myeongjo:wght@400;700"). 없으면 시스템 글꼴 */
  google?: string;
}

export const DEFAULT_HEADER_FONT_ID = "default";

export const HEADER_FONTS: readonly HeaderFont[] = [
  { id: DEFAULT_HEADER_FONT_ID, label: "기본 (고딕)", stack: `var(--font-sans), "Malgun Gothic", sans-serif` },
  { id: "nanum-gothic", label: "나눔고딕", stack: `"Nanum Gothic", "Malgun Gothic", sans-serif`, google: "Nanum+Gothic:wght@400;700" },
  { id: "nanum-myeongjo", label: "나눔명조", stack: `"Nanum Myeongjo", "Batang", serif`, google: "Nanum+Myeongjo:wght@400;700" },
  { id: "noto-serif-kr", label: "본명조", stack: `"Noto Serif KR", "Batang", serif`, google: "Noto+Serif+KR:wght@400;700" },
  { id: "gowun-batang", label: "고운바탕", stack: `"Gowun Batang", "Batang", serif`, google: "Gowun+Batang:wght@400;700" },
  { id: "gowun-dodum", label: "고운돋움", stack: `"Gowun Dodum", "Malgun Gothic", sans-serif`, google: "Gowun+Dodum" },
  { id: "nanum-pen", label: "나눔손글씨 펜", stack: `"Nanum Pen Script", cursive`, google: "Nanum+Pen+Script" },
  { id: "song-myung", label: "송명", stack: `"Song Myung", "Batang", serif`, google: "Song+Myung" },
  { id: "classic-serif", label: "클래식 세리프 (영문 악보풍)", stack: `"Times New Roman", "Noto Serif KR", serif` },
];

/** 머리글 기본 글자 크기(px) 와 허용 범위 — score-schema 의 headerFontSize(10~48)와 맞춤 */
export const DEFAULT_HEADER_FONT_SIZE = 14;
export const HEADER_FONT_SIZE_MIN = 10;
export const HEADER_FONT_SIZE_MAX = 36;

/** id 로 글꼴을 찾는다. 모르는 id·undefined 는 기본 글꼴 */
export function headerFontById(id: string | undefined): HeaderFont {
  return HEADER_FONTS.find((f) => f.id === id) ?? HEADER_FONTS[0];
}

/** 웹 글꼴 스타일시트 주소. 시스템 글꼴이면 null */
export function googleFontHref(font: HeaderFont): string | null {
  return font.google ? `https://fonts.googleapis.com/css2?family=${font.google}&display=swap` : null;
}

/** 허용 범위로 맞춘 글자 크기(px, 정수). 없거나 잘못된 값은 기본 크기 */
export function clampHeaderFontSize(size: number | undefined): number {
  if (size === undefined || !Number.isFinite(size)) return DEFAULT_HEADER_FONT_SIZE;
  return Math.min(HEADER_FONT_SIZE_MAX, Math.max(HEADER_FONT_SIZE_MIN, Math.round(size)));
}
