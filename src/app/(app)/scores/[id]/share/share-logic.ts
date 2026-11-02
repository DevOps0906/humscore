import type { ShareError } from "@/app/actions/share";
import { SHARE_MAX_EXPIRY_DAYS } from "@/lib/storage/share-constants";

export const SHARE_ERROR_TEXT: Record<ShareError, string> = {
  disabled: "이 환경에서는 공유를 쓸 수 없어요.",
  unauthenticated: "로그인이 필요해요.",
  invalid: "만료일은 오늘부터 최대 1년 안에서 골라 주세요.",
  unsynced: "동기화 후 공유할 수 있어요.",
  stale: "방금 수정한 내용이 아직 올라가지 않았어요. 잠시 후 다시 시도해 주세요.",
  limit: "공유 중인 링크가 너무 많아요. 안 쓰는 링크를 먼저 꺼 주세요.",
  failed: "문제가 생겼어요. 잠시 후 다시 시도해 주세요.",
};

export type ShareBlock = { message: string; action: "login" | "retry" | "none" };

/** S02 진입 불가 사유(없으면 null). 비로그인·체험 계정은 로그인 안내, 미동기화는 동기화 안내 */
export function shareBlockReason(i: { authStatus: string; mock: boolean; hasScore: boolean; unsynced: boolean }): ShareBlock | null {
  if (i.authStatus === "loading") return null;
  if (i.authStatus !== "signed-in" || i.mock) {
    return { message: "링크 공유는 로그인한 뒤에 쓸 수 있어요. 로그인하면 악보가 안전하게 동기화돼요.", action: "login" };
  }
  if (!i.hasScore) return { message: "이 기기에서 악보를 찾을 수 없어요.", action: "none" };
  if (i.unsynced) return { message: "아직 서버에 올라가지 않은 악보예요. 동기화 후 공유할 수 있어요.", action: "retry" };
  return null;
}

/** YYYY-MM-DD(로컬 날짜의 끝, 23:59:59) → ISO. 빈 값/잘못된 형식/범위 밖이면 null */
export function expiryIsoFromDate(date: string, now = Date.now()): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const ms = new Date(`${date}T23:59:59`).getTime();
  if (!Number.isFinite(ms) || ms <= now || ms > now + SHARE_MAX_EXPIRY_DAYS * 86_400_000) return null;
  return new Date(ms).toISOString();
}
