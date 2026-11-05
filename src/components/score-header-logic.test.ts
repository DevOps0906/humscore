import { describe, expect, it } from "vitest";
import { ensureFontStylesheet, formatCreditLines, formatCredits, formatTempo, type StyleDocLike } from "./score-header-logic";
import { headerFontById } from "@/lib/music/header-fonts";

function fakeDoc(): StyleDocLike & { added: { id: string; href: string }[] } {
  const added: { id: string; rel: string; href: string }[] = [];
  return {
    added,
    head: { appendChild: (n) => added.push(n as { id: string; rel: string; href: string }) },
    getElementById: (id) => added.find((a) => a.id === id) ?? null,
    createElement: () => ({ id: "", rel: "", href: "" }),
  };
}

describe("formatCredits", () => {
  it("값이 있는 항목을 각각 한 줄로 표시한다", () => {
    expect(formatCredits({ lyricist: "A", composer: "B", arranger: "C" })).toBe("작사 A\n작곡 B\n편곡 C");
    expect(formatCredits({ composer: "B" })).toBe("작곡 B");
    expect(formatCredits({ lyricist: " ", composer: "B", arranger: "" })).toBe("작곡 B");
    expect(formatCredits({})).toBe("");
    expect(formatCreditLines({ lyricist: "A", composer: "B", arranger: "C" })).toEqual(["작사 A", "작곡 B", "편곡 C"]);
    expect(formatCredits({ lyricist: " \t ", composer: "\n", arranger: "  " })).toBe("");
    expect(formatCredits({ lyricist: " 첫째 ", composer: " 둘째 ", arranger: " 셋째 " })).toBe("작사 첫째\n작곡 둘째\n편곡 셋째");
  });
});

describe("formatTempo", () => {
  it("빠르기말과 BPM", () => expect(formatTempo("Adagio", 72)).toBe("Adagio ♩ = 72"));
});

describe("ensureFontStylesheet", () => {
  it("웹 글꼴은 한 번만 주입한다", () => {
    const doc = fakeDoc();
    const f = headerFontById("nanum-myeongjo");
    expect(ensureFontStylesheet(f, doc)).toBe(true);
    expect(ensureFontStylesheet(f, doc)).toBe(false);
    expect(doc.added).toHaveLength(1);
    expect(doc.added[0].href).toContain("fonts.googleapis.com");
  });
  it("시스템 글꼴·document 없음은 아무것도 안 한다", () => {
    const doc = fakeDoc();
    expect(ensureFontStylesheet(headerFontById("default"), doc)).toBe(false);
    expect(ensureFontStylesheet(headerFontById("nanum-pen"), undefined)).toBe(false);
    expect(doc.added).toHaveLength(0);
  });
});
