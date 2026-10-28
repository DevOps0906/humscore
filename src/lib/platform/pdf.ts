/**
 * 최소 PDF 작성기 — JPEG 이미지 여러 장을 A4 한 장씩 담는다 (의존성 없음, 순수 함수).
 * 객체: 1 Catalog · 2 Pages · 페이지마다 (Page, Contents, Image) 3개.
 */

export interface PdfJpegPage {
  jpeg: Uint8Array;
  /** JPEG 픽셀 크기 */
  width: number;
  height: number;
}

export const A4_W = 595;
export const A4_H = 842;
export const PDF_MARGIN = 28;

const ascii = (s: string) => Uint8Array.from(s, (c) => c.charCodeAt(0) & 0xff);

export function buildImagePdf(pages: PdfJpegPage[]): Uint8Array {
  if (pages.length === 0) throw new Error("페이지가 없습니다");

  const chunks: Uint8Array[] = [];
  const offsets: number[] = [0]; // 객체 번호 1부터 — 0번은 자리표시
  let pos = 0;
  const push = (b: Uint8Array) => {
    chunks.push(b);
    pos += b.length;
  };
  const text = (s: string) => push(ascii(s));
  const startObj = (n: number) => {
    offsets[n] = pos;
    text(`${n} 0 obj\n`);
  };

  // %가 바이너리임을 알리는 4바이트 주석
  push(Uint8Array.from([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a, 0x25, 0xe2, 0xe3, 0xcf, 0xd3, 0x0a]));

  startObj(1);
  text("<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");

  const pageNum = (i: number) => 3 + i * 3;
  startObj(2);
  text(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${pageNum(i)} 0 R`).join(" ")}] >>\nendobj\n`);

  pages.forEach((p, i) => {
    const n = pageNum(i);
    const maxW = A4_W - PDF_MARGIN * 2;
    const maxH = A4_H - PDF_MARGIN * 2;
    const s = Math.min(maxW / p.width, maxH / p.height);
    const w = +(p.width * s).toFixed(2);
    const h = +(p.height * s).toFixed(2);
    const x = +((A4_W - w) / 2).toFixed(2);
    const y = +(A4_H - PDF_MARGIN - h).toFixed(2);
    const content = `q ${w} 0 0 ${h} ${x} ${y} cm /Im0 Do Q`;

    startObj(n);
    text(
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${A4_W} ${A4_H}] /Resources << /XObject << /Im0 ${n + 2} 0 R >> >> /Contents ${n + 1} 0 R >>\nendobj\n`,
    );
    startObj(n + 1);
    text(`<< /Length ${content.length} >>\nstream\n${content}\nendstream\nendobj\n`);
    startObj(n + 2);
    text(
      `<< /Type /XObject /Subtype /Image /Width ${p.width} /Height ${p.height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${p.jpeg.length} >>\nstream\n`,
    );
    push(p.jpeg);
    text("\nendstream\nendobj\n");
  });

  const count = 3 + pages.length * 3; // 객체 수(0번 포함)
  const xrefPos = pos;
  text(`xref\n0 ${count}\n0000000000 65535 f \n`);
  for (let n = 1; n < count; n++) text(`${String(offsets[n]).padStart(10, "0")} 00000 n \n`);
  text(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${xrefPos}\n%%EOF\n`);

  const out = new Uint8Array(pos);
  let o = 0;
  for (const c of chunks) {
    out.set(c, o);
    o += c.length;
  }
  return out;
}
