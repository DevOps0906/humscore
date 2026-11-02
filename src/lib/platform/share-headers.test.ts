import { describe, expect, it } from "vitest";
import { applyShareHeaders, isSharePath } from "./share-headers";

describe("공유 경로 헤더", () => {
  it("/s/ 아래에만 3종 헤더를 붙인다", () => {
    const h = new Headers();
    applyShareHeaders("/s/abc", h);
    expect(h.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(h.get("cache-control")).toBe("no-store");
    expect(h.get("referrer-policy")).toBe("no-referrer");
    const other = new Headers();
    applyShareHeaders("/scores/1/share", other);
    applyShareHeaders("/library", other);
    expect([...other.keys()]).toEqual([]);
  });
  it("isSharePath: 접두 /s/ 만", () => {
    expect(isSharePath("/s/x")).toBe(true);
    expect(isSharePath("/s")).toBe(false);
    expect(isSharePath("/scores/x")).toBe(false);
  });
});
