import { A4_H, A4_W, PDF_MARGIN, buildImagePdf, type PdfJpegPage } from "./pdf";
import { cutsBetween, planSlices, type Span } from "./pdf-slices";

/**
 * 악보(OSMD가 그린 SVG)를 이미지 PDF 바이트로 만든다 (브라우저 전용).
 * SVG → canvas → JPEG → A4 세로 분할(시스템 경계 우선). 머리글은 OSMD 밖이라 직접 canvas에 그린다.
 */

const MAX_CANVAS_W = 4096;
const MAX_CANVAS_AREA = 16e6; // iOS canvas 면적 상한(여유)
const FONT = '"Noto Sans KR","Apple SD Gothic Neo","Malgun Gothic",sans-serif';

interface Piece {
  img: HTMLImageElement;
  w: number; // CSS px
  h: number;
}

function loadSvg(svg: SVGSVGElement): Promise<Piece> {
  const r = svg.getBoundingClientRect();
  const w = Math.ceil(r.width);
  const h = Math.ceil(r.height);
  const clone = svg.cloneNode(true) as SVGSVGElement;
  clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
  clone.setAttribute("width", String(w));
  clone.setAttribute("height", String(h));
  if (!clone.getAttribute("viewBox")) clone.setAttribute("viewBox", `0 0 ${w} ${h}`);
  const url = URL.createObjectURL(new Blob([new XMLSerializer().serializeToString(clone)], { type: "image/svg+xml;charset=utf-8" }));
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ img, w, h });
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("악보 이미지를 만들지 못했어요"));
    };
    img.src = url;
  });
}

const toJpeg = (c: HTMLCanvasElement) =>
  new Promise<Uint8Array>((resolve, reject) =>
    c.toBlob(
      (b) => (b ? b.arrayBuffer().then((a) => resolve(new Uint8Array(a)), reject) : reject(new Error("JPEG 변환 실패"))),
      "image/jpeg",
      0.9,
    ),
  );

/**
 * @param container OSMD 가 SVG 를 그린 컨테이너 (그 안의 svg 만 사용)
 * @param headerLines 머리글 — [제목, "작사 ○○ · 작곡 ○○"] 처럼 위에서 아래로. OSMD 가 제목을 이미 그렸다면 빈 배열
 * @param pageSystems SVG(페이지)별 시스템의 세로 범위(px, SVG 위쪽 기준). 길이가 SVG 수와 다르면 무시하고 고정 분할
 */
export async function sheetToPdf(container: HTMLElement, headerLines: string[], pageSystems: Span[][] = []): Promise<Uint8Array> {
  const svgs = [...container.querySelectorAll<SVGSVGElement>("svg")].filter((s) => s.getBoundingClientRect().width > 50);
  if (svgs.length === 0) throw new Error("내보낼 악보가 없어요");
  const pieces: Piece[] = [];
  for (const s of svgs) pieces.push(await loadSvg(s));

  const cssW = Math.max(...pieces.map((p) => p.w));
  const lines = headerLines.filter(Boolean);
  const headH = lines.length ? 24 + lines.length * 26 : 0;
  const totalH = headH + pieces.reduce((a, p) => a + p.h, 0);

  // A4 내용 영역 비율로 한 페이지 높이(CSS px)
  const sliceH = Math.floor((cssW * (A4_H - PDF_MARGIN * 2)) / (A4_W - PDF_MARGIN * 2));
  const scale = Math.min(2.5, MAX_CANVAS_W / cssW, Math.sqrt(MAX_CANVAS_AREA / (cssW * sliceH)));

  // 시스템 경계 컷 (전체 좌표). 조각 경계도 자연스러운 컷이다.
  const spans: Span[] = [];
  let off = headH;
  pieces.forEach((p, i) => {
    const sys = pageSystems.length === pieces.length ? pageSystems[i] : [{ top: 0, bottom: p.h }];
    for (const s of sys) spans.push({ top: s.top + off, bottom: s.bottom + off });
    off += p.h;
  });
  const slices = planSlices(totalH, sliceH, cutsBetween(spans, totalH));

  const pages: PdfJpegPage[] = [];
  for (const [top, bottom] of slices) {
    const h = bottom - top;
    const canvas = document.createElement("canvas");
    try {
      canvas.width = Math.round(cssW * scale);
      canvas.height = Math.max(1, Math.round(h * scale));
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("canvas를 쓸 수 없어요");
      ctx.fillStyle = "#fff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.scale(scale, scale);
      ctx.translate(0, -top);

      ctx.fillStyle = "#111";
      ctx.textAlign = "center";
      lines.forEach((t, i) => {
        ctx.font = i === 0 ? `600 22px ${FONT}` : `14px ${FONT}`;
        ctx.fillText(t, cssW / 2, 32 + i * 26, cssW - 32);
      });
      let y = headH;
      for (const p of pieces) {
        if (y + p.h > top && y < bottom) ctx.drawImage(p.img, 0, y, p.w, p.h);
        y += p.h;
      }
      pages.push({ jpeg: await toJpeg(canvas), width: canvas.width, height: canvas.height });
    } finally {
      canvas.width = canvas.height = 0; // iOS 메모리 해제
    }
  }
  return buildImagePdf(pages);
}
