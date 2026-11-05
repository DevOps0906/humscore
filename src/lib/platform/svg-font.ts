import { googleFontHref, headerFontById } from "@/lib/music/header-fonts";

const embeddedFonts = new Map<string, Promise<string>>();

async function request(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, { signal: controller.signal, credentials: "omit" });
    if (!response.ok) throw new Error("글꼴 응답 오류");
    return response;
  } finally { clearTimeout(timeout); }
}

function dataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("글꼴 변환 오류"));
    reader.readAsDataURL(blob);
  });
}

/** 독립 SVG 이미지에서도 선택한 웹폰트를 쓰도록 필요한 글자만 포함한다. */
export async function embedSvgFont(svg: SVGSVGElement): Promise<void> {
  const font = headerFontById(svg.dataset.scoreFontId);
  const href = googleFontHref(font);
  if (!href) return;
  const characters = [...new Set(Array.from([...svg.querySelectorAll("text")].map((text) => text.textContent ?? "").join("")))].sort().join("");
  if (!characters) return;
  const url = `${href}&text=${encodeURIComponent(characters)}`;
  if (!embeddedFonts.has(url)) {
    const pending = (async () => {
      let css = await (await request(url)).text();
      if (/@import\b/i.test(css)) throw new Error("외부 스타일 오류");
      const urls = [...new Set([...css.matchAll(/url\(\s*(?:"([^"]+)"|'([^']+)'|([^\s)]+))\s*\)/g)].map((match) => match[1] ?? match[2] ?? match[3]))];
      if (!urls.length) throw new Error("글꼴 파일 없음");
      for (const source of urls) {
        const parsed = new URL(source);
        if (parsed.protocol !== "https:" || parsed.hostname !== "fonts.gstatic.com") throw new Error("글꼴 주소 오류");
      }
      const sources = await Promise.all(urls.map(async (source) => {
        const parsed = new URL(source);
        if (parsed.protocol !== "https:" || parsed.hostname !== "fonts.gstatic.com") throw new Error("글꼴 주소 오류");
        return [source, await dataUrl(await (await request(source)).blob())] as const;
      }));
      for (const [source, embedded] of sources) css = css.replaceAll(source, embedded);
      return css;
    })();
    embeddedFonts.set(url, pending);
    pending.catch(() => embeddedFonts.delete(url));
  }
  try {
    const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = await embeddedFonts.get(url)!;
    svg.prepend(style);
  } catch {
    throw new Error("선택한 글꼴을 PDF에 넣지 못했어요. 인터넷 연결을 확인하거나 기본 글꼴로 바꿔 주세요.");
  }
}
