# task-020 찬양 콘티(세트리스트) — 기능 명세

> 근거: `01_PRD.md#2`(S2a·S2b)·`#3`(P1 찬양 콘티)·`#7`(#7 저작권), `03_SCREENS_UX.md` C01~C04, `05_DATA_MODEL.md#setlists · setlist_items`, `diagrams/flow-F-C.mmd`, [task-019 명세](task-019-share-link.md).
> 표기: [확인] = 코드·마이그레이션에서 확인, [추정] = 근거 없는 제안값(팀장 확정 전 구현 금지), `미확인` = 외부 조사 필요.

## 1. 목적·범위
인도자(S2a)가 내 악보로 예배 콘티(순서·키·템포·진행·메모)를 짜서 팀원(S2b)에게 읽기 전용 링크로 나누고 인쇄·공연한다.

| 구분 | 포함 | 제외(이후) |
|---|---|---|
| MVP | C01 목록 · C02 편집 · C03 보기·공유(링크 복사·끄기)·A4 인쇄 | 일괄 작업·저장된 보기(`03` 85행), 버전 이력, 팀원 공동 편집 |
| C04 공연 모드 | 기존 `src/app/(app)/scores/[id]/perform/perform-client.tsx`(페달 ←/→·PageUp/Down·Space [확인])를 곡 단위로 감싸 이전/다음 곡 이동만 추가 | 새 악보 렌더러·스크롤 방식 변경 |
| 공통 | 원본 `Score` 불변, 항목에 `transpose` 값만 저장(`web.md` 규칙 [확인]) | `Score` 타입 변경(팀장 결정 사항, 이번엔 없음) |
- 선행: task-019 공유 링크(마이그레이션 `20261102100000_share_links.sql` [확인]), task-001 앱 PDF(인쇄·PDF 내보내기 앱 경로). 비로그인 사용 불가(`03` C01 권한=로그인).

## 2. 사용자 흐름 (F-C, `diagrams/flow-F-C.mmd`)
| 단계 | 화면 | 행동 | 결과 |
|---|---|---|---|
| 1 | C01 | 새 콘티 | 빈 콘티 생성 → C02 |
| 2 | C02 | 예배명·예배일 입력, 곡 추가(내 악보 중 **클라우드 동기화된** 악보에서 선택), 순서·키·템포·진행·메모 지정, 저장 | 저장됨 → C03 |
| 3 | C03 | 공유 링크 복사 / 끄기 / A4 인쇄 / 공연 모드 | 팀원에게 `/s/[token]` 전달 |
| 4 | C03(`/s/[token]`) | 팀원이 비로그인으로 열람 | 순서표 + 곡별 악보(키 반영) 읽기 |
| 5 | C04 | 소유자·링크 소지자가 곡을 이어서 넘김 | 마지막 곡 끝 안내 |
- 미동기화(로컬 전용) 악보는 곡 추가 목록에서 "동기화 후 추가 가능"으로 비활성 — 공유 RPC가 서버 `scores`만 읽기 때문 [확인 구조].

## 3. 화면별 상태·반응형
화면 정의·블록·상태·3구간 레이아웃의 정본은 `03_SCREENS_UX.md` C01~C04 행(19~22·42~45·62~65행)이다. 여기서는 재기술하지 않고 구현 시 추가로 필요한 규칙만 적는다.

| 화면 | 추가 규칙 |
|---|---|
| C01 | 예배일 내림차순, `deleted_at is null`만. 곡 수 = `jsonb_array_length(items)` |
| C02 | 삭제된 악보를 가리키는 항목은 "삭제된 악보" 행으로 표시·제거 버튼만(`03` 43행 오류 상태). 키 표시 = 원본 키 + 항목 `transpose` |
| C03 | 소유자 경로와 `/s/[token]` 경로가 같은 표 컴포넌트, 링크 경로에는 편집·공유 버튼 없음. 인쇄는 A4 고정 레이아웃(`03` 64행) |
| C04 | 곡 0개면 진입 불가(`03` 45행). 링크 경로는 RPC 결과(메모리)만 사용, 로컬 저장소 미접근 |
- `03` 표의 데이터 칸 `setlist_items`는 4장 결정에 따라 갱신 필요(작업 g).

## 4. 데이터 모델 (초안, 새 마이그레이션)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | 클라이언트 생성 허용 여부는 5장 결정에 따름(scores는 클라이언트 id [확인]) |
| user_id | uuid not null FK auth.users on delete cascade | 인덱스 (user_id, service_date desc) |
| title | text not null | 예배명. 길이 상한 [추정 100자] |
| service_date | date not null | 예배일(`03` C02 필수) |
| items | jsonb not null default '[]' | `[{scoreId, transpose, bpm, form, note}]` 순서 = 배열 순서 |
| updated_at | timestamptz not null default now() | LWW 기준 |
| deleted_at | timestamptz null | 소프트 삭제 |
| created_at | timestamptz not null default now() | scores 관례 [확인] |

| items 필드 | 타입·검증(zod + DB check) | 비고 |
|---|---|---|
| scoreId | uuid | FK 없음(jsonb) → 아래 트리거로 소유 확인 |
| transpose | int −24~24 | `score-schema.ts` 범위와 동일 [확인]. 의미(절대/상대)는 9장 #3 |
| bpm | number 1~400 또는 null | null=원본 bpm. 범위는 `score-schema.ts` [확인] |
| form | text null, 상한 [추정 200자] | 진행 순서 문자열(예: 전주-A-B-B-C-후렴×2) |
| note | text null, 상한 [추정 500자] | 곡 메모 |
- 배열 길이 상한 [추정 50곡], `items` 크기 상한 [추정 64KB] — DB check(`jsonb_array_length`·`octet_length(items::text)`)로 강제.
- 트리거(`20261019212458` 패턴 그대로 [확인]): `setlists_a_clamp`(미래 `updated_at`·`deleted_at` 5분 보정) → `setlists_b_lww`(`new.updated_at <= old.updated_at`면 무시) → `setlists_c_row_cap`(사용자당 살아있는 콘티 2000개, errcode 53400). 모두 `set search_path = ''`.
- 소유 확인 트리거 `setlists_d_items_owner`(before insert/update, `security invoker`): `items`의 모든 `scoreId`가 `scores.user_id = new.user_id`인지 확인, 아니면 거부. 삭제된 악보는 허용(표시용, 3장 C02). 공유 RPC가 소유자 필터를 다시 하므로 방어선 2중.
- 원본 `scores`는 읽기만 한다. 콘티 저장이 `scores`를 갱신하는 경로는 없다.
- 인도자 멘트·곡 간 전환 메모(`03` C02 블록)의 저장 위치는 9장 #2.

## 5. 동기화
| 안 | 방식 | 장점 | 단점 |
|---|---|---|---|
| A 재사용 | `src/lib/storage/scores.ts` 구조(localStorage + dirty·tombstone + `mergeScores` + Server Action, 30초 간격 재동기화 [확인])를 `setlists.ts`로 복제 | 오프라인 편집·공연, 화면 즉시 반응 | 코드 2배, 병합·계정 전환·mock 분리 로직까지 복제·테스트 필요 |
| B 서버 전용 | Server Action(zod)으로 직접 읽기·쓰기, 저장 버튼 = 저장(`03` 83행). DB LWW 트리거로 다중 탭·기기 충돌 방지 | 구현·테스트 최소, 콘티는 로그인 전제라 로컬 단계 불필요 | 오프라인 편집 불가, 저장 실패 시 재시도 UI 필요(`03` 43행에 이미 있음) |
- **권고: B.** 콘티는 로그인 전용이고 입력이 짧다. 공연 모드 오프라인은 진입 시 콘티+악보를 메모리에 받아두는 것으로 충분 [추정]. 오프라인 요구가 확인되면 A로 확장(DB 스키마는 A·B 공통이라 재작업 없음).
- 저장 충돌: 클라이언트가 보낸 `updated_at`이 서버보다 오래되면 LWW 트리거가 0행 → Action이 `stale` 반환 → "다른 기기에서 수정됨, 다시 불러오기" 안내(scores의 `stale` 처리 관례 [확인]).

## 6. 공유
| 안 | 방식 | 장점 | 단점 |
|---|---|---|---|
| A `share_links` 확장 | nullable `setlist_id` FK(on delete cascade) + `num_nonnulls(score_id, setlist_id) = 1` check, `score_id` not null 해제 | 토큰·해시·회수·만료·200개 상한·`/s/[token]` 라우트 재사용. task-019 12장 #2 **결정과 일치** [확인] | 적용된 테이블 변경 → insert 정책·부분 유니크·재발급 RPC를 새 마이그레이션에서 교체해야 함 |
| B 별도 `setlist_share_links` | 같은 구조 테이블 복제 | 기존 악보 공유 경로 무변경 | 토큰 경로·상한·트리거 2벌, `/s/[token]`이 두 테이블 조회 |
- **권고: A**(이미 결정). 새 마이그레이션에서 할 일:
  1. `score_id` not null 해제, `setlist_id` 추가·인덱스·check, 부분 유니크 `(setlist_id) where revoked_at is null`.
  2. insert 정책 drop→재생성: `owner_id = auth.uid()` 이고 (`score_id`가 본인 미삭제 악보) **또는** (`setlist_id`가 본인 미삭제 콘티).
  3. `setlists.deleted_at` null→값 시 링크 회수 트리거(`scores_revoke_shares` 패턴 [확인]).
  4. `reissue_setlist_share_link(p_setlist_id, p_token_hash, p_expires_at)` 추가(기존 `reissue_share_link`는 score 전용 유지).
  5. 200개 상한은 악보·콘티 링크 합산(기존 트리거 그대로) — 9장 #5.
- 익명 RPC `get_shared_setlist(p_token text)` (`security definer`, `stable`, `search_path = ''`, anon·authenticated execute만, `get_shared_score` 관례 [확인]):
  - 반환: `title`, `service_date`, `items`(jsonb), `scores`(jsonb 배열 `[{id, title, data}]`). `user_id`·`deleted_at`·이메일 미반환.
  - 포함 악보 조건: `items`에 있는 id ∩ `scores.user_id = setlist.user_id` ∩ `deleted_at is null`. 빠진 곡은 클라이언트가 "볼 수 없는 곡"으로 표시.
  - 토큰 형식 불일치·회수·만료·콘티 삭제·없음 → 모두 0행(동일 응답).
  - `get_shared_score`는 `setlist_id` 링크에 대해 0행이어야 함(기존 join이 `score_id` 기준이라 자동 충족 [확인 구조], 테스트로 고정).
- `/s/[token]` 페이지: 먼저 `get_shared_score`, 0행이면 `get_shared_setlist` 순 호출 [추정] — 또는 RPC 하나로 통합(9장 #6). 헤더·캐시·레이트 리밋은 task-019 6·8장 그대로.
- 실시간 반영(task-019 12장 #3 결정 [확인]): 콘티·포함 악보 수정이 링크에 즉시 반영.

## 7. 위협 메모·RLS
| 항목 | 콘티 공유 링크 (P1) |
|---|---|
| 노출 면 | `/s/[token]` 공개 페이지 + RPC `get_shared_setlist`(anon, REST 직접 호출 가능 — task-019 4.1과 같이 수용) |
| 인증·인가 | 토큰=능력. `setlists`는 소유자만, anon 정책 없음. RPC가 포함 악보를 **콘티 소유자의 악보로만** 필터 |
| 다루는 데이터 | 콘티 제목·예배일·항목·포함 악보 제목·음표 데이터. 소유자 표시명·이메일·`user_id`·출처 URL 비노출 |
| 필요한 키·권한 | anon 키만, service_role 사용 금지(`01#8`). 트리거·재발급 함수 `revoke execute … from public, anon, authenticated` 후 필요한 것만 재부여 |
| 입력 | 토큰 zod(43자 base64url), `items` zod + DB check(길이·크기·범위), 반환 `data`는 `score-schema.ts`로 재검증 후 렌더 |
| 체인 | ① `items`에 타인 `scoreId` 삽입 → RPC로 타인 악보 노출: 소유 확인 트리거 + RPC 소유자 필터로 차단 ② 콘티 링크로 `get_shared_score` 호출 → 0행 ③ 대용량 `items`로 RPC 응답 비대 → 50곡·64KB 상한 [추정] |
| 피해 범위 | 유출 토큰의 콘티 1개 + 그 콘티의 소유자 악보(최대 50곡 [추정]). 회수로 즉시 차단 |
| 로그 | 토큰·해시·악보 본문 로그 금지(task-019 6장) |

| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| setlists | `user_id = (select auth.uid())` | 같음(with check) | 같음(using·with check) | 같음(앱은 `deleted_at` 사용, 하드 삭제는 계정 정리용) |
| share_links | 기존 소유자 정책 유지 | 6장 2번으로 교체 | `revoked_at` 컬럼만(기존) | 기존 |
- 위험도 **높음**(RLS·마이그레이션·노출 면): challenger 착수 전, codex-reviewer(code) + reviewer(security) 변경 후.

## 8. 수용 기준
| # | 기준 | 확인 |
|---|---|---|
| 1 | 로그인 사용자가 콘티를 만들고 곡 추가·순서 변경·저장 후 C01에 예배일 내림차순으로 보인다 | E2E |
| 2 | 항목 `transpose` 변경 후 원본 `scores.data`가 바뀌지 않는다 | 단위(Action) + V3 |
| 3 | 오래된 `updated_at` 쓰기는 무시되고 Action이 `stale`을 반환한다 | V3 + 단위 |
| 4 | 사용자당 2001번째 살아있는 콘티 insert가 53400으로 거부된다 | V3 |
| 5 | `items` 51곡·64KB 초과·범위 밖 `transpose`/`bpm`이 zod와 DB 양쪽에서 거부된다 | 단위 + V3 |
| 6 | 타인 `scoreId`가 든 `items` insert/update가 거부된다 | V3 |
| 7 | anon이 `setlists`를 직접 select하면 0행/거부 | V3 |
| 8 | 유효 토큰으로 `get_shared_setlist`가 콘티+포함 악보를 반환하고 `user_id`가 없다 | V3 |
| 9 | 회수·만료·콘티 삭제·잘못된 토큰이 같은 화면/응답, 콘티 삭제→복구 후에도 링크는 꺼진 채 | 단위 + V3 |
| 10 | 콘티 링크 토큰으로 `get_shared_score`는 0행, 악보 링크 토큰으로 `get_shared_setlist`는 0행 | V3 |
| 11 | 삭제된 포함 악보는 링크에서 "볼 수 없는 곡", C02에서 "삭제된 악보"로 표시된다 | 단위 + E2E |
| 12 | 비로그인 `/s/[token]` 열람·C04에서 다음/이전 곡·페달 키로 곡 이동, 편집 UI 없음 | E2E |
| 13 | 응답 헤더 `X-Robots-Tag: noindex`·`Cache-Control: no-store`·`Referrer-Policy: no-referrer` | 단위(헤더) |
| 14 | A4 인쇄 미리보기에서 순서표가 한 페이지 폭에 맞는다 | E2E 스크린샷 |
| 15 | 3구간 레이아웃·토큰만 사용 | codex-reviewer(design) |
| 16 | `npm run lint`·`npx tsc --noEmit`·`npm test` 통과 | 명령 |
- V3(DB 통합)는 Docker 또는 원격 개발 브랜치 필요(task-019 9장, 원격은 사용자 승인 후). 미실시 시 마이그레이션 "미검증"·배포 금지.

## 9. 결정 필요
| # | 질문 | 권고 | 결정자 |
|---|---|---|---|
| 1 | 항목 저장: `items` jsonb(이번 지시) vs `05`의 `setlist_items` 테이블 | **jsonb** — 순서 변경이 한 행 갱신, LWW 단위가 콘티 1개로 단순. 대가: FK 없음 → 소유 확인 트리거 필요. 채택 시 `05#setlists`·`03` 데이터 칸 정정 | 팀장 결정 필요 |
| 2 | 인도자 멘트·곡 간 전환 메모(`03` C02) 저장 위치 | `setlists.memo`(멘트) 컬럼 1개 + 항목 `transition` 필드 1개 추가 — 지시 초안에 없는 필드라 확정 필요 | 팀장 결정 필요 |
| 3 | 항목 `transpose` 의미 | **원본 악보 기준 절대값**(악보 자체 `transpose`를 대체). 상대값이면 원본 전조 변경 시 콘티 키가 바뀜 | 팀장 결정 필요 |
| 4 | 동기화 A(로컬 우선) vs B(서버 전용) | **B**(5장) | 팀장 결정 필요 |
| 5 | 공유 링크 상한 200개를 악보·콘티 합산 vs 분리 | **합산**(기존 트리거 무변경) | 팀장 결정 필요 |
| 6 | `/s/[token]` 조회: RPC 2개 순차 vs 통합 RPC 1개 | **순차 2개** — 기존 `get_shared_score` 무변경, 검증 범위 최소 | 팀장 결정 필요 |
| 7 | 예배 찬양 저작권(`01#7` 7번: CCLI 등 국내 교회 저작권 처리)과 콘티 공유 정책 | 구현은 진행하되 **공개 배포 전 사용자 결정**. 기본안: 링크는 사용자가 직접 만든 음표 데이터만 노출(곡 번들 없음, `01#6`), C03·`/s/[token]` 하단에 "저작권은 이용자 책임·교회 라이선스 확인" 안내 + 신고 링크 자리(task-019 12장 #9와 한 정책으로). 국내 CCLI 적용 범위·악보 재배포 허용 여부 `미확인`(법률 검토 필요) | 사용자 |
| 8 | 콘티 공유의 무료/Pro 경계 | 악보 공유와 같이 **잠정 무료**, 서버 액션 한 곳에서 막을 수 있게(task-019 12장 #8) | 사용자 |
| 9 | 상한 수치(50곡·64KB·제목 100자·form 200자·note 500자) | 제안값 채택 후 베타 실측으로 조정 — 근거 `미확인` | 팀장 결정 필요 |

## 10. 작업 분해 (순차, 9장 #1~#4 결정 후 착수)
| 작업 | 담당 | 쓰기 영역 | 위험도 | 완료 조건 |
|---|---|---|---|---|
| a. 착수 전 공격(4·6·7장) | challenger | — | 높음 | 지적 반영 후 명세 갱신 |
| b. 마이그레이션: `setlists`·트리거 4종·RLS | builder | `supabase/**` | 높음 | V2 리뷰, 8장 #2~#7 SQL 테스트 작성 |
| c. 마이그레이션: `share_links` 확장·`get_shared_setlist`·재발급·회수 트리거 | builder | `supabase/**` | 높음 | V2 리뷰, 8장 #8~#10 |
| d. 저장 계층: zod 스키마·Server Actions(`src/app/actions/setlists.ts`) | builder | `src/app/actions/**`, `src/lib/storage/**` | 보통 | 8장 #1·#3·#5 단위 테스트 |
| e. 화면 C01·C02·C03(소유자 경로)·인쇄 | builder | `src/app/**`, `src/components/**` | 보통 | `shot` 3구간, 8장 #11·#14·#15 |
| f. 공유: 링크 Action·`/s/[token]` 콘티 분기·C04 래퍼(기존 perform 재사용) | builder | `src/app/**`, `src/proxy.ts` | 높음 | 8장 #9·#12·#13 |
| g. 테스트: 단위 + V3 SQL + E2E(`e2e/**`) | tester | 테스트 파일 | 보통 | 8장 전 항목 |
| h. 문서 정정: `05#setlists`, `03` C01~C04 데이터 칸, `04_API.md` 콘티 Action·RPC 행, ERD(`sql2erd`) | planner·diagrammer | `docs/**` | 낮음 | reviewer(doc) |
- b·c는 같은 파일 묶음이라 순차. d는 b 이후, e·f는 d 이후 병렬 가능(쓰기 영역 겹침 시 worktree).

## 수익·사업 관점
수익=콘티 공유·클라우드 보관을 Pro 묶음 후보로(`01#4`, 9장 #8) / 가장 싼 검증=베타 교회 2~3곳에 콘티 링크 배포 후 `01#5` 주간 콘티 생성·공유 수 집계 / 자동화=전부 자동 / 정부지원 연결=`미확인`.
