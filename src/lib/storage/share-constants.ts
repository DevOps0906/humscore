/** 공유 링크 상수 (클라이언트·서버 공용, 의존성 없음) */

/** 만료일 최대치(일). DB 트리거는 'now() + 1 year' 라 이보다 넓다 */
export const SHARE_MAX_EXPIRY_DAYS = 365;
