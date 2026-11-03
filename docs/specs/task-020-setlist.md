# task-020 찬양 콘티(세트리스트) — 기능 명세

> 결정(2026-11-03): challenger REVISE(B1~B3·C1~C5) 반영 — jsonb items·서버 전용 CAS 동기화·share_links 확장·C04 MVP 제외·reissue 제외, 남은 사용자 결정은 9장 #7·#8뿐.
> 근거: `01_PRD.md#2`(S2a·S2b)·`#3`(P1 찬양 콘티)·`#7`(#7 저작권), `03_SCREENS_UX.md` C01~C03, `05_DATA_MODEL.md#setlists · setlist_items`, `diagrams/flow-F-C.mmd`, [task-019 명세](task-019-share-link.md), `src/app/actions/share.ts`, `supabase/migrations/20261102100000_share_links.sql`.
> 표기: [확인] = 코드·마이그레이션에서 확인, [추정] = 근거 없는 제안값(베타 실측으로 조정), `미확인` = 외부 조사 필요.

## 1. 목적·범위
인도자(S2a)가 내 악보로 예배 콘티(순서·키·템포·진행·메모)를 짜서 팀원(S2b)에게 읽기 전용 링크로 나누고 인쇄한다.

| 구분 | 포함 | 제외(이후) |
|---|---|---|
| MVP | C01 목록 · C02 편집 · C03 보기·공유(링크 복사·끄기)·A4 인쇄 | 일괄 작업·저장된 보기(`03` 85행), 버전 이력, 팀원 공동 편집, 링크 재발급(C4) |
| C04 공연 모드 | — | **후속 작업**(B3). 기존 `perform-client.tsx`를 곡 단위로 감싸는 안은 후속 명세에서 다룬다 |
| 공통 | 원본 `Score` 불변, 항목에 `transpose` 값만 저장(`web.md` [확인]) | `Score` 타입 변경(이번엔 없음) |
- 선행: task-019 공유 링크(`20261102100000_share_links.sql` [확인]), task-001 앱 PDF(인쇄 앱 경로). 비로그인 사용 불가(`03` C01 권한=로그인).

## 2. 사용자 흐름 (F-C, `diagrams/flow-F-C.mmd`)
| 단계 | 화면 | 행동 | 결과 |
|---|---|---|---|
| 1 | C01 | 새 콘티 | 빈 콘티 생성 → C02 |
| 2 | C02 | 예배명·예배일·인도자 멘트 입력, 곡 추가(**클라우드 동기화된** 내 악보만), 순서·키·템포·진행·곡 메모·전환 메모 지정, 저장 | 저장됨 → C03 |
| 3 | C03 | 공유 링크 복사 / 끄기 / A4 인쇄 / 메모 공개 켜기·끄기 | 팀원에게 `/s/[token]` 전달 |
| 4 | C03(`/s/[token]`) | 팀원이 비로그인으로 열람 | 순서표 + 곡별 악보(항목 키 반영) 읽기 |
- 미동기화(로컬 전용) 악보는 곡 추가 목록에서 "동기화 후 추가 가능"으로 비활성 — 공유 RPC가 서버 `scores`만 읽기 때문 [확인 구조].

## 3. 화면별 추가 규칙
화면 정의·블록·상태·3구간 레이아웃의 정본은 `03_SCREENS_UX.md` C01~C03 행. 여기서는 구현 시 추가 규칙만 적는다.

| 화면 | 추가 규칙 |
|---|---|
| C01 | 예배일 내림차순, `deleted_at is null`만. 곡 수 = `jsonb_array_length(items)` |
| C02 | 곡 추가 시 `item.transpose` 기본값 = 그 악보의 현재 `score.transpose` 복사(C3). 이후 키 표시·렌더는 `item.transpose`만 사용(`score.transpose` 무시). 삭제된 악보를 가리키는 항목은 "삭제된 악보" 행 + 제거 버튼만, 제거 전엔 저장 불가(4장 소유 확인 트리거가 거부) |
| C03 | 소유자 경로와 `/s/[token]` 경로가 같은 표 컴포넌트, 링크 경로엔 편집·공유 버튼 없음. 렌더는 `item.transpose`만 적용. 인쇄는 A4 고정(`03` 64행) |
- `03`의 C04 행은 "후속"으로, 데이터 칸 `setlist_items`는 jsonb로 정정(작업 i).

## 4. 데이터 모델 (새 마이그레이션)
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK default gen_random_uuid() | 서버 전용 동기화라 서버 생성 |
| user_id | uuid not null FK auth.users on delete cascade | 인덱스 (user_id, service_date desc) |
| title | text not null | 예배명, 상한 100자 [추정] |
| service_date | date not null | 예배일(`03` C02 필수) |
| memo | text null | 인도자 멘트, 상한 1000자 [추정] |
| share_notes | boolean not null default true | 링크 소지자에게 memo·note·transition 공개 여부(결정 10, 컬럼명 제안) |
| items | jsonb not null default '[]' | 순서 = 배열 순서, 필드는 아래 표 |
| updated_at | timestamptz not null default now() | CAS 기준. 트리거가 insert·update마다 서버 `now()`로 덮어씀 |
| deleted_at | timestamptz null | 소프트 삭제 |
| created_at | timestamptz not null default now() | scores 관례 [확인] |

| items 필드 | 타입·검증(zod + DB check) | 비고 |
|---|---|---|
| scoreId | uuid | FK 없음 → 소유 확인 트리거 |
| transpose | int −24~24 | `score-schema.ts` 범위 [확인]. 원본 기준 절대값, 기본값 = 추가 시점 `score.transpose` |
| bpm | number 1~400 또는 null | null = 원본 bpm(`score-schema.ts` [확인]) |
| form | text null, 상한 200자 [추정] | 진행 순서(예: 전주-A-B-B-C-후렴×2) |
| note | text null, 상한 500자 [추정] | 곡 메모 |
| transition | text null, 상한 300자 [추정] | 다음 곡으로의 전환 메모 |
- 배열 50곡·`items` 64KB [추정] 상한 — DB check(`jsonb_array_length`·`octet_length(items::text)`).
- 트리거(모두 `set search_path = ''`, `revoke execute … from public, anon, authenticated`):
  - `setlists_a_touch`(before insert/update): `new.updated_at := now()`. clamp·LWW 트리거는 두지 않는다(B2).
  - `setlists_b_row_cap`(before insert): 사용자당 살아있는 콘티 2000개, errcode 53400 (`20261019212458` 패턴 [확인]).
  - `setlists_c_items_owner`(before insert/update of items·user_id, `security invoker`): **긍정형**(C1) — `items`의 모든 원소가 `scoreId` uuid 형식이고, 각각 `scores.id = scoreId and user_id = new.user_id and deleted_at is null` 행이 존재해야 통과. 하나라도 아니면 거부(23514).
  - `setlists_d_revoke_shares`(after update of deleted_at, null→값): 콘티 링크 회수(`scores_revoke_shares` 패턴 [확인]).
- 원본 `scores`는 읽기만. 콘티 저장이 `scores`를 갱신하는 경로는 없다.

## 5. 동기화 (결정: 서버 전용 + CAS)
- Server Action(`src/app/actions/setlists.ts`, zod)으로 직접 읽기·쓰기, 저장 버튼 = 저장(`03` 83행). 로컬 저장소·dirty·tombstone 없음.
- 저장 = CAS: 클라이언트가 마지막으로 받은 `updated_at`을 보내고 `update … where id = ? and user_id = ? and updated_at = <기준>`. 새 시각은 트리거의 서버 `now()`.
- 0행이면 Action이 `stale` 반환 → "다른 곳에서 바뀌었어요, 다시 불러오기" 안내. 덮어쓰기 없음.
- 기준 `updated_at`은 서버가 준 문자열 그대로 왕복한다(`Date` 변환 시 마이크로초 손실로 항상 stale — `share.ts`의 `Date.parse` 비교 방식과 다름 [확인]).

## 6. 공유 (결정: `share_links` 확장)
새 마이그레이션에서 할 일:
1. `score_id` not null 해제, `setlist_id uuid` FK `setlists` on delete cascade 추가·인덱스, check `num_nonnulls(score_id, setlist_id) = 1`, 부분 유니크 `(setlist_id) where revoked_at is null`.
2. insert 정책 drop→재생성: `owner_id = auth.uid()` 이고 (`score_id`가 본인 미삭제 악보) **또는** (`setlist_id`가 본인 미삭제 콘티).
3. 200개 상한은 악보·콘티 링크 **합산**(기존 `share_links_guard` 무변경).
4. 재발급 RPC 추가 없음(C4). 기존 `reissue_share_link`는 score 전용 유지.
- 익명 RPC `get_shared_setlist(p_token text)` (`security definer`, `stable`, `search_path = ''`, anon·authenticated execute만, `get_shared_score` 관례 [확인]):
  - 반환은 노출 필드만 골라 만든다: `title`, `service_date`, `items`(`scoreId`·`transpose`·`bpm`·`form`), `share_notes`가 true일 때만 `memo`·항목 `note`·`transition`, `scores`(`[{id, title, data}]`). `user_id`·`deleted_at`·`share_notes` 자체·이메일 미반환.
  - 포함 악보 = `items`의 id ∩ `scores.user_id = setlist.user_id` ∩ `deleted_at is null`. 빠진 곡은 클라이언트가 "볼 수 없는 곡".
  - 포함 악보 `data` 합계 상한 1MB [추정](C2): 배열 순서로 누적해 넘는 곡부터 제외 → "볼 수 없는 곡" 처리.
  - 토큰 형식 불일치·회수·만료·콘티 삭제·없음 → 모두 0행.
  - `get_shared_score`는 콘티 링크에 0행(join이 `score_id` 기준 [확인 구조], 테스트로 고정).
- `/s/[token]`: `get_shared_score` → 0행이면 `get_shared_setlist` 순차 호출(결정). 헤더·캐시·레이트 리밋은 task-019 6·8장 그대로.
- 실시간 반영(task-019 12장 #3 [확인]): 콘티·포함 악보 수정이 링크에 즉시 반영.

### 6.1 기존 공유 액션 겸용화 (B1)
`share.ts`는 모두 `score_id` 전제 [확인]. 콘티 링크가 생기면 아래가 깨지므로 콘티 기능보다 먼저 고친다.

| 함수 | 현재 문제 [확인] | 수정 |
|---|---|---|
| `listShareLinks` | `listRowSchema.score_id: z.uuid()` → `score_id` null 행 1개로 목록 전체 `failed` | 대상 `{kind: 'score'\|'setlist', id}`, `setlists(title, deleted_at)` join 추가 |
| `getShareStatus` · `revokeShareLink` | `score_id`만 인자 | 대상 `{kind, id}` 인자, 각 컬럼으로 필터 |
| `createShareLink` 만료 정리 | `score_id` 기준 update만 | 콘티 링크 생성 시 `setlist_id` 기준으로 같은 정리 |
- 설정 탭 공유 링크 관리(커밋 8312f85)가 `listShareLinks` 사용 → 콘티 링크도 표시·끄기.

### 6.2 배포·롤백 (C5)
- 배포 순서: 마이그레이션 → 기존 액션 수정(6.1) → 콘티 기능.
- 롤백: 콘티 링크 삭제(`delete from share_links where setlist_id is not null`) → check·`setlist_id` 제거 → `score_id` set not null 복원 → insert 정책 원복(새 마이그레이션으로).

## 7. 위협 메모·RLS
| 항목 | 콘티 공유 링크 (P1) |
|---|---|
| 노출 면 | `/s/[token]` 공개 페이지 + RPC `get_shared_setlist`(anon, REST 직접 호출 가능 — task-019 4.1과 같이 수용) |
| 인증·인가 | 토큰=능력. `setlists`는 소유자만, anon 정책 없음. RPC가 포함 악보를 **콘티 소유자의 미삭제 악보로만** 필터 |
| 다루는 데이터 | 콘티 제목·예배일·항목·포함 악보 제목·음표 데이터, `share_notes` 켜짐 시 멘트·곡 메모·전환 메모. 소유자 표시명·이메일·`user_id`·출처 URL 비노출 |
| 필요한 키·권한 | anon 키만, service_role 금지(`01#8`). 트리거 함수 execute 회수 |
| 입력 | 토큰 zod(43자 base64url), `items`·`memo` zod + DB check, 반환 `data`는 `score-schema.ts`로 재검증 후 렌더 |
| 체인 | ① 타인 실제 `scoreId`를 `items`에 주입 → RPC로 타인 악보 노출: 긍정형 소유 트리거 + RPC 소유자 필터 ② 콘티 토큰으로 `get_shared_score` → 0행 ③ 대용량 응답: 50곡·64KB·`data` 합계 1MB [추정] ④ 메모에 개인정보 기입 → C03에 "링크에 메모 공개" 토글·표시 |
| 피해 범위 | 유출 토큰의 콘티 1개 + 그 콘티의 소유자 악보(최대 50곡). 끄기로 즉시 차단 |
| 로그 | 토큰·해시·악보 본문·메모 로그 금지(task-019 6장) |

| 테이블 | select | insert | update | delete |
|---|---|---|---|---|
| setlists | `user_id = (select auth.uid())` | 같음(with check) | 같음(using·with check) | 같음(앱은 `deleted_at`, 하드 삭제는 계정 정리용) |
| share_links | 기존 소유자 정책 | 6장 2번으로 교체 | `revoked_at` 컬럼만(기존) | 기존 |
- 위험도 **높음**(RLS·마이그레이션·노출 면·외부 계약): codex-reviewer(code) + reviewer(security) 변경 후.

## 8. 수용 기준
| # | 기준 | 확인 |
|---|---|---|
| 1 | 콘티 생성·곡 추가·순서 변경·저장 후 C01에 예배일 내림차순 | E2E |
| 2 | 곡 추가 시 `item.transpose` = 그 악보의 `score.transpose`, 이후 항목 키 변경해도 `scores.data`·`scores.transpose` 불변, 렌더는 `item.transpose`만 반영 | 단위 + V3 |
| 3 | 두 탭 동시 저장: 먼저 저장한 쪽만 반영, 늦은 쪽은 `stale` + 다시 불러오기 안내, 덮어쓰기 없음 | 단위 + V3 + E2E |
| 4 | 클라이언트가 보낸 `updated_at` 값은 무시되고 서버 `now()`가 저장된다 | V3 |
| 5 | 사용자당 2001번째 살아있는 콘티 insert → 53400 | V3 |
| 6 | 51곡·64KB 초과·범위 밖 `transpose`/`bpm`·상한 넘는 텍스트가 zod와 DB 양쪽에서 거부 | 단위 + V3 |
| 7 | 타인의 **실제 존재하는** `scoreId`·없는 uuid·uuid 아닌 값·내 삭제된 악보가 든 `items` insert/update 모두 거부 | V3 |
| 8 | anon이 `setlists` 직접 select → 0행/거부 | V3 |
| 9 | 유효 토큰으로 `get_shared_setlist`가 콘티+포함 악보 반환, `user_id`·`share_notes` 없음. `share_notes=false`면 `memo`·`note`·`transition` 없음 | V3 |
| 10 | 포함 악보 `data` 합계 1MB 초과 시 초과분 곡이 빠지고 응답이 상한 이하 | V3 |
| 11 | 회수·만료·콘티 삭제·잘못된 토큰이 같은 응답, 콘티 삭제→복구 후에도 링크는 꺼진 채 | 단위 + V3 |
| 12 | 콘티 토큰으로 `get_shared_score` 0행, 악보 토큰으로 `get_shared_setlist` 0행 | V3 |
| 13 | 회귀: 콘티 링크가 있어도 기존 악보 링크의 `listShareLinks`·`getShareStatus`·`revokeShareLink`·만료 정리가 전과 같다 | 단위 + V3 |
| 14 | 삭제된 포함 악보는 링크에서 "볼 수 없는 곡", C02에서 "삭제된 악보"(제거 전 저장 불가) | 단위 + E2E |
| 15 | 비로그인 `/s/[token]` 열람, 편집 UI 없음 | E2E |
| 16 | 헤더 `X-Robots-Tag: noindex`·`Cache-Control: no-store`·`Referrer-Policy: no-referrer` | 단위(헤더) |
| 17 | A4 인쇄 미리보기에서 순서표가 한 페이지 폭에 맞음 | E2E 스크린샷 |
| 18 | 3구간 레이아웃·토큰만 사용 | codex-reviewer(design) |
| 19 | 롤백 SQL(6.2)이 로컬에서 적용·되돌리기 모두 성공 | V3 |
| 20 | `npm run lint`·`npx tsc --noEmit`·`npm test` 통과 | 명령 |
- V3(DB 통합)는 Docker 또는 원격 개발 브랜치 필요(task-019 9장, 원격은 사용자 승인 후). 미실시 시 마이그레이션 "미검증"·배포 금지.

## 9. 결정 기록·남은 결정
| # | 질문 | 상태 |
|---|---|---|
| 1 | 항목 저장 방식 | **결정**: `items` jsonb(4장). `05#setlists`·`03` 데이터 칸 정정(작업 i) |
| 2 | 인도자 멘트·전환 메모 위치 | **결정**: `setlists.memo` + 항목 `transition`(4장) |
| 3 | 항목 `transpose` 의미 | **결정**: 원본 기준 절대값, 기본값 = 추가 시점 `score.transpose` 복사, 렌더는 `item.transpose`만(C3) |
| 4 | 동기화 | **결정**: 서버 전용 + CAS(5장) |
| 5 | 링크 상한 | **결정**: 악보·콘티 합산 200개 |
| 6 | `/s/[token]` 조회 | **결정**: RPC 2개 순차 |
| 9 | 상한 수치(50곡·64KB·1MB·제목 100·memo 1000·form 200·note 500·transition 300자) | **결정**: 제안값 채택, 베타 실측으로 조정 — 근거 `미확인` |
| 10 | 링크 소지자 메모 노출 | **결정**: 기본 공개, `share_notes`로 사용자 변경, RPC는 노출 필드만 반환 |
| 7 | 예배 찬양 저작권(`01#7` 7번: CCLI 등)과 콘티 공유 정책 | **사용자 결정 필요**(공개 배포 전). 기본안: 사용자 작성 음표 데이터만 노출(`01#6`), C03·`/s/[token]` 하단 "저작권은 이용자 책임·교회 라이선스 확인" 안내 + 신고 링크 자리(task-019 12장 #9와 한 정책). 국내 CCLI 적용 범위·재배포 허용 `미확인`(법률 검토 필요) |
| 8 | 콘티 공유 무료/Pro 경계 | **사용자 결정 필요**. 기본안: 악보 공유와 같이 잠정 무료, 서버 액션 한 곳에서 막을 수 있게(task-019 12장 #8) |

## 10. 작업 분해 (구현 순서)
| 순서 | 작업 | 담당 | 쓰기 영역 | 위험도 | 완료 조건 |
|---|---|---|---|---|---|
| a | 마이그레이션 1: `setlists`·트리거 4종·RLS·check | builder | `supabase/migrations/**` | 높음 | 8장 #4~#8 SQL 테스트 작성, codex-reviewer(code)+reviewer(security) |
| b | 마이그레이션 2: `share_links` 확장(6장 1·2)·`get_shared_setlist`(노출 필드·1MB 상한)·롤백 SQL 초안(6.2) | builder | `supabase/migrations/**` | 높음 | 8장 #9~#12·#19, 같은 리뷰 |
| c | 기존 공유 액션 겸용화(6.1) + 회귀 테스트 | builder · tester | `src/app/actions/share.ts`, 설정 탭 공유 목록 컴포넌트 / 테스트 파일 | 높음 | 8장 #13, 기존 share 테스트 전부 통과 |
| d | 저장 계층: zod 스키마·CAS Server Actions(`setlists.ts`) | builder | `src/app/actions/setlists.ts`, `src/lib/storage/**` | 보통 | 8장 #1·#3·#6 단위 테스트 |
| e | 화면 C01·C02·C03(소유자 경로)·A4 인쇄·`share_notes` 토글 | builder | `src/app/**`, `src/components/**` | 보통 | `shot` 3구간, 8장 #2·#14·#17·#18 |
| f | 콘티 공유: 링크 Action(콘티 대상)·`/s/[token]` 순차 분기 | builder | `src/app/**`, `src/proxy.ts` | 높음 | 8장 #11·#15·#16 |
| g | 테스트 보강: 단위 + V3 SQL + E2E(두 탭 저장 포함) | tester | `**/__tests__/**`, `*.test.ts`, `e2e/**` | 보통 | 8장 전 항목 |
| h | V3 실행·배포(6.2 순서: a·b → c → d~f) | 팀장 | — | 높음 | V3 통과 전 배포 금지 |
| i | 문서 정정: `05#setlists`, `03` C01~C04(C04 후속 표기·데이터 칸), `04_API.md` 콘티 Action·RPC 행, ERD(`sql2erd`) | planner · diagrammer | `docs/**` | 낮음 | reviewer(doc) |
| 후속 | C04 공연 모드(별도 task, 명세 새로 작성) | — | — | — | MVP 범위 밖 |
- a·b는 같은 영역이라 순차. c는 b 이후·d보다 먼저(배포 순서). e·f는 d 이후 병렬 가능(쓰기 영역 겹침 시 worktree).

## 수익·사업 관점
수익=콘티 공유·클라우드 보관을 Pro 묶음 후보로(`01#4`, 9장 #8) / 가장 싼 검증=베타 교회 2~3곳에 콘티 링크 배포 후 `01#5` 주간 콘티 생성·공유 수 집계 / 자동화=전부 자동 / 정부지원 연결=`미확인`.
