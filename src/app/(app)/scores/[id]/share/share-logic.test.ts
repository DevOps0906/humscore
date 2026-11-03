import { describe, expect, it } from "vitest";
import { expiryIsoFromDate, shareBlockReason } from "./share-logic";

const ok = { authStatus: "signed-in", mock: false, hasScore: true, unsynced: false };

describe("S02 공유 진입 판단", () => {
  it("비로그인·체험 로그인은 로그인 안내", () => {
    expect(shareBlockReason({ ...ok, authStatus: "signed-out" })?.action).toBe("login");
    expect(shareBlockReason({ ...ok, mock: true })?.action).toBe("login");
    expect(shareBlockReason({ ...ok, authStatus: "disabled" })?.action).toBe("login");
  });
  it("미동기화는 동기화 안내, 정상이면 null, 로딩 중도 null", () => {
    expect(shareBlockReason({ ...ok, unsynced: true })?.action).toBe("retry");
    expect(shareBlockReason({ ...ok, hasScore: false })?.action).toBe("none");
    expect(shareBlockReason(ok)).toBeNull();
    expect(shareBlockReason({ ...ok, authStatus: "loading" })).toBeNull();
  });
});

describe("만료일 입력", () => {
  const now = new Date("2026-11-02T00:00:00").getTime();
  it("범위 안 날짜는 ISO, 과거·1년 초과·잘못된 형식은 null", () => {
    expect(expiryIsoFromDate("2026-12-01", now)).not.toBeNull();
    expect(expiryIsoFromDate("2026-11-01", now)).toBeNull();
    expect(expiryIsoFromDate("2028-01-01", now)).toBeNull();
    expect(expiryIsoFromDate("", now)).toBeNull();
    expect(expiryIsoFromDate("2026/12/01", now)).toBeNull();
  });
});
