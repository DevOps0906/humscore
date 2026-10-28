import { describe, expect, it } from "vitest";
import { buildImagePdf } from "./pdf";

const latin1 = (b: Uint8Array) => Buffer.from(b).toString("latin1");
const fakeJpeg = (n: number) => Uint8Array.from({ length: n }, (_, i) => (i === 0 ? 0xff : i % 251));

describe("buildImagePdf", () => {
  const jpegs = [fakeJpeg(300), fakeJpeg(1234)];
  const pdf = buildImagePdf(jpegs.map((jpeg) => ({ jpeg, width: 800, height: 1100 })));
  const s = latin1(pdf);

  it("헤더와 EOF", () => {
    expect(s.startsWith("%PDF-1.4")).toBe(true);
    expect(s.trimEnd().endsWith("%%EOF")).toBe(true);
  });

  it("xref 오프셋이 각 객체 시작 위치와 일치", () => {
    const startxref = Number(/startxref\n(\d+)\n%%EOF/.exec(s)![1]);
    expect(s.slice(startxref, startxref + 4)).toBe("xref");
    const m = /xref\n0 (\d+)\n/.exec(s.slice(startxref))!;
    const count = Number(m[1]);
    expect(count).toBe(3 + 2 * 3);
    const entries = s.slice(startxref + m[0].length).split("\n").slice(0, count);
    expect(entries[0]).toBe("0000000000 65535 f ");
    for (let n = 1; n < count; n++) {
      expect(entries[n]).toMatch(/^\d{10} 00000 n $/);
      const off = Number(entries[n].slice(0, 10));
      expect(s.slice(off, off + `${n} 0 obj`.length)).toBe(`${n} 0 obj`);
    }
    expect(s).toContain(`/Size ${count}`);
  });

  it("페이지 수와 JPEG 바이트 보존", () => {
    expect(s).toContain("/Count 2");
    for (const j of jpegs) {
      const a = latin1(j);
      expect(s.includes(`/Length ${j.length} >>\nstream\n${a}\nendstream`)).toBe(true);
    }
  });

  it("빈 입력은 오류", () => {
    expect(() => buildImagePdf([])).toThrow();
  });
});
