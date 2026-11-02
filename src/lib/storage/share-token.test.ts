import { describe, expect, it } from "vitest";
import { checkShareExpiry, generateShareToken, hashShareToken, shareTokenSchema } from "./share-token";

describe("공유 토큰", () => {
  it("생성: 43자 base64url, 매번 다름", () => {
    const a = generateShareToken();
    expect(a).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(shareTokenSchema.safeParse(a).success).toBe(true);
    expect(generateShareToken()).not.toBe(a);
  });

  it("형식 검증: 길이·문자 불일치 거부", () => {
    for (const bad of ["", "a".repeat(42), "a".repeat(44), `${"a".repeat(42)}=`, `${"a".repeat(42)}/`, `${"a".repeat(42)}가`]) {
      expect(shareTokenSchema.safeParse(bad).success).toBe(false);
    }
  });

  // 벡터: SQL encode(pg_catalog.sha256(pg_catalog.convert_to(token,'UTF8')),'hex') 와 동일해야 한다.
  // 'abc' 는 NIST 표준 벡터. 두 번째는 43자 토큰 형태(Node 로 산출, 동일 UTF-8 sha256 hex).
  it("해시 벡터 V1: Node 해시 = SQL 식 (UTF-8 sha256 소문자 hex)", () => {
    expect(hashShareToken("abc")).toBe("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad");
    expect(hashShareToken("AbCdEfGhIjKlMnOpQrStUvWxYz0123456789-_AbCdE")).toBe(
      "b247256873be366d3ca8d06ccf98652d0b49257194f6220d4bfdffb3063ca122",
    );
    expect(hashShareToken(generateShareToken())).toMatch(/^[0-9a-f]{64}$/); // DB check 제약과 같은 형식
  });

  it("만료일: 미래·1년 이내만 허용", () => {
    const now = Date.parse("2026-11-02T00:00:00.000Z");
    expect(checkShareExpiry("2026-11-03T00:00:00.000Z", now)).toBe("2026-11-03T00:00:00.000Z");
    expect(checkShareExpiry("2026-11-01T00:00:00.000Z", now)).toBeNull();
    expect(checkShareExpiry("2027-11-03T00:00:00.000Z", now)).toBeNull(); // 365일 초과
    expect(checkShareExpiry("not-a-date", now)).toBeNull();
  });
});
