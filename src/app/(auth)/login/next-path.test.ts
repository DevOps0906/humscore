import { describe, expect, it } from "vitest";
import { safeNextPath } from "./next-path";

const O = "https://humscore.app";

describe("safeNextPath", () => {
  it("같은 사이트 경로는 그대로(경로·쿼리·해시만)", () => {
    expect(safeNextPath("/keys", O)).toBe("/keys");
    expect(safeNextPath("/scores/1?x=1#a", O)).toBe("/scores/1?x=1#a");
    expect(safeNextPath(`${O}/keys`, O)).toBe("/keys");
  });

  it("없거나 외부로 가는 값은 /library (디코딩된 \\·탭·// 포함)", () => {
    const bad = [null, "", "//example.org", "/\\example.org", "\\\\example.org", "/\t/example.org", "/\n/example.org", "https://example.org/x", "javascript:alert(1)"];
    for (const b of bad) expect(safeNextPath(b, O), JSON.stringify(b)).toBe("/library");
  });

  it("?next=/%5cexample.org · /%09/example.org 쿼리도 차단", () => {
    for (const q of ["?next=/%5cexample.org", "?next=/%09/example.org", "?next=%2F%2Fexample.org"]) {
      expect(safeNextPath(new URLSearchParams(q).get("next"), O), q).toBe("/library");
    }
  });
});
