# 04. API (Server Action · RPC · 페이지)

> 정본. 기능 배경·결정은 각 명세(`specs/`)에, 인터페이스는 여기에만 쓴다. 보안 위협 표는 `01_PRD.md#8`.

## 공유 링크 (task-019, [명세](specs/task-019-share-link.md))
| 이름 | 종류 | 입력 | 출력 | 권한 | 오류 |
|---|---|---|---|---|---|
| `createShareLink(scoreId, updatedAt, expiresAt?)` | Server Action | uuid, 클라이언트 `updatedAt`, 미래 시각(최대 1년) | 원문 토큰 URL 1회 | 로그인 소유자(RLS) | 미동기화·updatedAt 불일치·타인 악보·만료일 형식·상한 초과 |
| `revokeShareLink(scoreId)` | Server Action | uuid | ok | 소유자 | 없음이면 ok(멱등) |
| `getShareStatus(scoreId)` | Server Action | uuid | 활성 여부·만료일(토큰 없음) | 소유자 | — |
| `reissue_share_link` | RPC(`security invoker`) | score_id, 새 토큰 해시, expires_at? | ok | 소유자 | 한 트랜잭션: 기존 활성 revoke + insert. 실패 시 기존 링크 유지 |
| `get_shared_score(token text)` | RPC(`security definer`, `stable`) | 43자 base64url 토큰 | `table(title text, data jsonb)` 0~1행 | `anon`·`authenticated` execute만 | 형식 불일치·만료·회수·삭제·없음 모두 빈 결과(동일) |
| `/s/[token]` | 페이지(Server Component) | zod: 43자 base64url | 악보 렌더 | 링크 소지자 | 모두 동일 "열 수 없는 링크" |
- 부분 유니크 위반(`23505`)은 오류가 아니라 "이미 켜짐"으로 처리한다(동시 클릭 대비).
- `get_shared_score` 필수 조건·조회식·함수 권한은 명세 4.1·6장. 이 RPC는 Supabase REST로 직접 호출 가능하며 토큰 256비트로 열거 불가함을 수용한다.
