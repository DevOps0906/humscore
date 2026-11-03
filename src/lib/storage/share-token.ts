import { createHash, randomBytes } from "node:crypto";
import { z } from "zod";
import { SHARE_MAX_EXPIRY_DAYS } from "./share-constants";

/** 서버 전용(node:crypto). 클라이언트 번들에서 import 하지 않는다. */

/** 토큰 = 32바이트 난수의 base64url (43자, 256비트) */
export const SHARE_TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;
export const shareTokenSchema = z.string().regex(SHARE_TOKEN_PATTERN);


export function generateShareToken(): string {
  return randomBytes(32).toString("base64url");
}

/** SQL: encode(sha256(convert_to(token,'UTF8')),'hex') 와 같은 값 (소문자 hex 64자) */
export function hashShareToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

/** 만료일 검증: 미래 시각이고 최대 1년 이내면 ISO 문자열, 아니면 null */
export function checkShareExpiry(iso: string, now = Date.now()): string | null {
  const ms = Date.parse(iso);
  if (!Number.isFinite(ms)) return null;
  if (ms <= now || ms > now + SHARE_MAX_EXPIRY_DAYS * 86_400_000) return null;
  return new Date(ms).toISOString();
}

export const sharePath = (token: string) => `/s/${token}`;
