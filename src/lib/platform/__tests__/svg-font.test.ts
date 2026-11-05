import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const fontSource = "https://fonts.gstatic.com/s/nanumgothic/v1/subset.woff2";
const css = `@font-face { font-family: 'Nanum Gothic'; font-style: normal; font-weight: 400; src: url('${fontSource}') format('woff2'); }`;
const message = "선택한 글꼴을 PDF에 넣지 못했어요. 인터넷 연결을 확인하거나 기본 글꼴로 바꿔 주세요.";

interface TextStub { textContent: string; fontFamily: string }
interface StyleStub { textContent: string | null }

function svgFixture(fontId = "nanum-gothic", values = ["가나다 가", "A나B"]) {
  const texts: TextStub[] = values.map((textContent) => ({ textContent, fontFamily: "'Nanum Gothic', sans-serif" }));
  const styles: StyleStub[] = [];
  const svg = {
    dataset: { scoreFontId: fontId },
    querySelectorAll: vi.fn((selector: string) => selector === "text" ? texts : []),
    prepend: vi.fn((style: StyleStub) => styles.unshift(style)),
  } as unknown as SVGSVGElement;
  return { svg, texts, styles };
}

/** Node 환경에서 Blob 변환과 SVG 삽입 경계만 대신한다. */
class FileReaderStub {
  result: string | null = null;
  onload?: () => void;
  onerror?: () => void;

  readAsDataURL(blob: Blob) {
    void blob.arrayBuffer().then((bytes) => {
      this.result = `data:${blob.type};base64,${Buffer.from(bytes).toString("base64")}`;
      this.onload?.();
    }).catch(() => this.onerror?.());
  }
}

function successfulFetch() {
  return vi.fn(async (url: string) => url.startsWith("https://fonts.googleapis.com/")
    ? new Response(css)
    : new Response(new Blob([new Uint8Array([0, 1, 2, 3])], { type: "font/woff2" })));
}

beforeEach(() => {
  vi.resetModules();
  vi.stubGlobal("FileReader", FileReaderStub);
  vi.stubGlobal("document", {
    createElementNS: vi.fn(() => ({ textContent: null })),
  });
});

afterEach(() => vi.unstubAllGlobals());

describe("SVG 웹폰트 포함", () => {
  it("선택한 웹폰트에 표시 글자만 요청하고 바이너리를 data URI로 넣는다", async () => {
    const fetcher = successfulFetch();
    vi.stubGlobal("fetch", fetcher);
    const { embedSvgFont } = await import("../svg-font");
    const { svg, texts, styles } = svgFixture();
    await embedSvgFont(svg);

    expect(fetcher).toHaveBeenCalledTimes(2);
    const request = new URL(fetcher.mock.calls[0][0]);
    expect(request.origin).toBe("https://fonts.googleapis.com");
    expect(request.searchParams.get("family")).toContain("Nanum Gothic");
    const subset = Array.from(request.searchParams.get("text")!);
    expect(new Set(subset)).toEqual(new Set(Array.from("가나다 AB")));
    expect(subset).toHaveLength(new Set(subset).size);
    expect(fetcher.mock.calls[1][0]).toBe(fontSource);
    for (const [, options] of fetcher.mock.calls as unknown as [string, RequestInit][]) {
      expect(options.credentials).toBe("omit");
      expect(options.signal).toBeInstanceOf(AbortSignal);
    }
    expect(styles).toHaveLength(1);
    expect(styles[0].textContent).toContain("@font-face");
    expect(styles[0].textContent).toContain("font-family: 'Nanum Gothic'");
    expect(styles[0].textContent).toContain("data:font/woff2;base64,AAECAw==");
    expect(styles[0].textContent).not.toContain(fontSource);
    expect(texts.every((text) => text.fontFamily === "'Nanum Gothic', sans-serif")).toBe(true);

    const another = svgFixture("nanum-gothic", ["B나A", "가 다나"]);
    await embedSvgFont(another.svg);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(another.styles).toHaveLength(1);
  });

  it("시스템 글꼴이나 빈 SVG에는 네트워크를 사용하지 않는다", async () => {
    const fetcher = vi.fn();
    vi.stubGlobal("fetch", fetcher);
    const { embedSvgFont } = await import("../svg-font");
    for (const font of ["default", "classic-serif", "잘못된-글꼴"]) {
      const fixture = svgFixture(font);
      await embedSvgFont(fixture.svg);
      expect(fixture.styles).toEqual([]);
    }
    const blank = svgFixture("nanum-gothic", []);
    await embedSvgFont(blank.svg);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("가져오기 실패를 한국어로 알리고 같은 글꼴 요청을 다시 시도한다", async () => {
    const fetcher = successfulFetch().mockImplementationOnce(async () => new Response("오류", { status: 503 }));
    vi.stubGlobal("fetch", fetcher);
    const { embedSvgFont } = await import("../svg-font");
    const fixture = svgFixture();
    await expect(embedSvgFont(fixture.svg)).rejects.toThrow(message);
    expect(fixture.styles).toEqual([]);
    await embedSvgFont(fixture.svg);
    expect(fetcher).toHaveBeenCalledTimes(3);
    expect(fixture.styles[0].textContent).toContain("data:font/woff2;base64,");
  });

  it.each([
    "@font-face { src: url('https://example.com/untrusted.woff2'); }",
    `${css} @font-face { src: url('https://fonts.gstatic.com.evil.test/untrusted.woff2'); }`,
  ])("허용되지 않은 외부 주소가 들어간 CSS를 SVG에 포함하지 않는다", async (source) => {
    const fetcher = vi.fn(async () => new Response(source));
    vi.stubGlobal("fetch", fetcher);
    const { embedSvgFont } = await import("../svg-font");
    const fixture = svgFixture();
    await expect(embedSvgFont(fixture.svg)).rejects.toThrow(message);
    expect(fixture.styles).toEqual([]);
    expect(fetcher.mock.calls).toHaveLength(1);
  });
});
