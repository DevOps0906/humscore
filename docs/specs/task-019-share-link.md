# task-019 읽기 전용 공유 링크 — 기능 명세

> 표기: **[확인]** = 코드·문서에서 직접 확인 / **[추정]** = 확인 전 추정 / **[미확인]** = 근거 필요. 결정은 12장 기준.

## 1. 목적·범위
로그인한 소유자가 악보 1개의 읽기 전용 링크를 만들고, 링크 소지자(비로그인)가 보기·재생만 한다. 소유자는 언제든 끄거나 새로 발급한다.
- 근거: `01_PRD.md#3` P1 "읽기 전용 공유 링크 — 로그인 없이 보기, 편집 불가, 회수 가능"(미배정 [확인]), 보안 `01_PRD.md#8`, 화면 `03_SCREENS_UX.md` S01·S02, 데이터 `05_DATA_MODEL.md#share_links`.

| 포함 | 제외 |
|---|---|
| 악보(score) 1개 단위 링크 생성·복사·끄기·재발급, 만료일(선택) | 콘티(setlist) 공유(C03) — 콘티 때 nullable `setlist_id` 추가(7장) |
| `/s/[token]` 읽기 전용 보기·재생(S01), `/scores/[id]/share`(S02) | 열람자 편집·댓글·복제 저장, 열람자 계정/통계 |
| 공유 페이지 noindex·캐시 금지·레이트 리밋 | 조회수 집계 화면, 다운로드/PDF, 유튜브 출처 URL 노출(기본 비노출) |
| 소유자 삭제(`deleted_at`) 시 링크 무효·회수 | 저작권 신고 UI(`01_PRD.md#7` 장 6번, 별도 결정) |

## 2. 전제 — 기기 저장 vs 서버 [확인]
- `src/lib/storage/scores.ts`: 기본은 기기 localStorage, 로그인 시 `scores` 테이블로 동기화(`saveScore`·`syncFromCloud`·`flushPendingChanges`). **비로그인·미동기화 악보는 서버에 없다** → 링크로 열 수 없음.
- S02 상태는 해당 악보 id의 dirty·skipped·mock 여부로 구분한다: (a) 비로그인/mock: 로그인 안내, (b) 해당 id가 dirty 또는 skipped(서버에 없음·미동기화): "동기화 후 공유". 링크 생성 전 `flushPendingChanges()` 후, Server Action이 서버 행 존재와 **클라이언트 `updatedAt` = 서버 `updated_at`**을 다시 확인한다(불일치 시 거부).
- 열람은 항상 서버 `scores` 행을 읽는다(기기 데이터 무관). 마이크 음성은 해당 없음(음표 숫자만, `AGENTS.md` 4장).

## 3. 사용자 흐름
| 단계 | 동작 | 화면 |
|---|---|---|
| 진입 | 악보 상세 E01의 "공유" → S02 | `03_SCREENS_UX.md` F-S |
| 켜기 | "공유 켜기"(+만료일 선택) → 링크 생성, **원문 토큰은 이 응답에서 1회만 표시** | S02 |
| 복사 | "링크 복사" — 원문 토큰은 서버에 없으므로 **재방문 시 링크 재표시 불가**(복사 못 했으면 재발급) | S02 |
| 끄기 | "공유 끄기" → 확인 모달 → `revoked_at` 설정 | S02 |
| 재발급 | RPC `reissue_share_link`로 기존 링크 즉시 끄고 새 토큰 발급(기존 링크는 죽음) | S02 |
| 열람 | `/s/[token]` → 제목·악보·재생. 유효하지 않으면 단일 "열 수 없는 링크" 화면 | S01 |
- 상태·반응형은 `03_SCREENS_UX.md` S01·S02 행과 상태 표를 따른다(여기 재기술 안 함). S02 상태 "공유 꺼짐/생성 중/실패/복사됨"은 [확인] 존재. S01 상태(로딩·무효 링크·재생 중)는 03 상태 표에 반영됨.

## 4. 설계 결정
| 항목 | 결정 | 이유 |
|---|---|---|
| 토큰 생성 | 서버(Server Action)에서 `crypto.randomBytes(32)` → base64url 43자(256비트) | 추측 불가. 클라이언트 생성 금지 |
| 저장 | `token_hash` = `pg_catalog.sha256(convert_to(token,'UTF8'))`의 hex(소문자 64자)만 저장(원문 미저장). Node 쪽 insert 값도 같은 식(UTF-8 sha256 hex). 고엔트로피라 솔트·느린 해시 불필요 | DB 유출 시 링크 복원 불가. pgcrypto 불필요 |
| 링크 수 | 악보당 활성 1개(`revoked_at is null`) — 부분 유니크 인덱스 | 회수 단순, 남용 억제 |
| 만료 | 선택(기본 무기한). 만료·회수·삭제·없음 **모두 동일 응답** | 존재 여부 추측 방지 |
| 스냅샷 vs 실시간 | **실시간**(링크=현재 악보) | 구현 최소. 단점: 수정이 즉시 노출 → S02에 "수정 내용이 바로 반영됩니다" 안내 |
| 노출 필드 | `title`, `data`(Score)만. 소유자 표시명·이메일·`youtube_sources` URL 비노출 | `05#share_links`·`#youtube_sources` |
| 소유자 삭제 | `scores.deleted_at` null→값 전환 시 **같은 트랜잭션**에서 해당 `share_links.revoked_at = now()`(트리거). 되살아나도 링크는 꺼진 채(새로 발급). 하드 삭제·계정 삭제는 `score_id` FK cascade | 삭제 직후 즉시 차단, 복구로 인한 재노출 방지 |

### 4.1 익명 읽기 경로 (12장 #1: A 확정)
| 후보 | 방식 | 판정 |
|---|---|---|
| A | `security definer` RPC `get_shared_score(token text)` — 해시 비교·만료·회수·삭제 검사, `anon`에 execute만 부여. 페이지는 Server Component가 anon 키로 호출 | **채택** — service_role 불필요, 읽기 경로 SQL 한 곳, 테이블 직접 권한 0. 함수 오작성 시 전 악보 노출 → 보안 리뷰 필수 |
| B | Route/Server Component가 service_role로 조회 | 기각 — `01_PRD.md#8` "service_role 사용 금지"와 충돌 |
| C | `anon`에 `share_links`·`scores` select 정책 | **금지**(`05#share_links`) — 열거·스크래핑 위험 |
- A의 필수 조건: `stable`, `set search_path = ''`(기존 마이그레이션 관례 [확인]), `revoke all on function … from public` 후 `grant execute … to anon, authenticated`, 반환 `returns table(title text, data jsonb)` + `limit 1`, 토큰 형식(43자 base64url) 불일치 시 즉시 빈 결과, `scores.user_id` 미반환.
- 조회는 `share_links sl join public.scores s on s.id = sl.score_id and s.user_id = sl.owner_id`, 단일 WHERE: `sl.token_hash = <해시> and sl.revoked_at is null and (sl.expires_at is null or sl.expires_at > now()) and s.deleted_at is null`.
- RPC는 Supabase REST로 직접 호출 가능하다. 토큰이 256비트라 열거 불가 — 이 노출을 **수용**한다(레이트 리밋은 앱 경로만 보호, 8장).

## 5. 인터페이스 (Server Action·페이지·RPC)
Server Action·RPC·페이지 표(입력·출력·권한·오류)는 정본이 `04_API.md#공유 링크`다. 여기에 재기술하지 않는다.

## 6. 보안 (`01_PRD.md#8` 위협 표를 이 기능에 적용)
레벨 L2 배포(12장 #4 확정). 아래는 01#8 표에 **추가**되는 구체값만 적는다.

| 항목 | 내용 |
|---|---|
| 노출 면 | `/s/[token]` 공개 페이지 + RPC `get_shared_score`(anon, REST 직접 호출 가능 — 4.1 수용) |
| 인증·인가 | 토큰=능력(capability). insert 정책 `with check (owner_id = (select auth.uid()) and exists (select 1 from public.scores s where s.id = score_id and s.user_id = (select auth.uid()) and s.deleted_at is null))`. authenticated의 update는 `revoked_at` 컬럼만: `revoke update on public.share_links from authenticated; grant update (revoked_at) on public.share_links to authenticated;` |
| 한도 | 소유자당 활성 200개·만료일 최대 1년은 **DB 트리거**로 강제(`scores_row_cap` 관례 [확인]) — 앱 검사만으로 두지 않음 |
| 데이터 | 제목·음표 데이터만. 이메일·소유자 ID·출처 URL 비노출 |
| 키 | anon 키만 사용, service_role 사용 안 함 |
| 함수 권한 | 추가 함수(트리거·`reissue_share_link` 등)는 `revoke execute … from public, anon, authenticated`(필요한 것만 재부여). 트리거 함수는 `security invoker` |
| 입력 | 토큰 zod 형식 검증, 만료일 범위 검증, 반환 `data`는 `score-schema.ts`(zod) [확인 존재]로 재검증 후 렌더 |
| 체인 | 토큰이 URL에 있음 → Referer/히스토리/공유 앱 유출: `Referrer-Policy: no-referrer`, 외부 리소스 링크 없음(S01 "HumScore로 만들어 보기"는 `rel="noreferrer"`) |
| 피해 범위 | 유출된 토큰의 악보 1개. 회수로 즉시 차단 |
| 남용 | 레이트 리밋(8장), 열거 불가(256비트), 만료·회수·삭제 조건을 **단일 WHERE로 분기 없이 0행** 처리 |
| 로그 | 토큰 원문·해시·악보 본문을 앱 코드가 로그에 남기지 않음. IP 원문 저장 안 함(`01#8`) |
| 응답 헤더 | `X-Robots-Tag: noindex, nofollow` + `<meta name="robots">`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` — **`src/proxy.ts`에서 설정**. robots.txt `/s/` Disallow(보조) |
| 리뷰 | 위험도 **높음**(노출 면·RLS·마이그레이션): challenger 착수 전, codex-reviewer(code)+reviewer(security) 변경 후 |

## 7. 데이터·마이그레이션
| # | 파일(제안) | 내용 |
|---|---|---|
| M1 | `supabase/migrations/<ts>_share_links.sql` | `share_links` 생성(`05#share_links` 컬럼, `score_id uuid not null references public.scores(id) on delete cascade`), RLS 활성, 소유자 select/delete·insert(6장 `with check`)·update 정책 + 컬럼 권한(`revoked_at`만), 인덱스(`owner_id`, `score_id`), 부분 유니크(`score_id` where `revoked_at is null`), 테이블 코멘트 |
| M2 | 같은 파일 또는 `<ts>_get_shared_score.sql` | `get_shared_score`(4.1) + revoke/grant. 익명 쓰기 함수는 두지 않음 |
| M3 | 같은 파일 또는 `<ts>_share_links_guards.sql` | 트리거 함수(`security invoker`): 활성 200개 상한·만료 ≤ 1년(before insert), `scores.deleted_at` null→값 시 `revoked_at = now()`. RPC `reissue_share_link`. 모두 `revoke execute … from public, anon, authenticated` |
- 콘티 도입 시 nullable `setlist_id` 추가 + "`score_id`·`setlist_id` 중 정확히 하나" check는 새 마이그레이션(12장 #2).
- 적용된 마이그레이션(`scores`, `scores_sync_hardening`)은 수정하지 않는다 [확인 규칙]. `Score` 타입 변경 없음. 완료 후 `sql2erd`로 `docs/diagrams/erd.mmd` 갱신, 타입 재생성(`db.md`).

## 8. 레이트 리밋·캐시
| 대상 | 제안 | 비고 |
|---|---|---|
| `/s/[token]` 열람 | IP당 분당 N회 초과 시 429 | N [미확인]. 구현 위치: 배포 설정(Vercel 방화벽, 12장 #5); 인스턴스 간 공유 저장소 없으면 앱 레벨 제한은 약함 |
| 생성/회수 Action | 사용자당 분당 10회 [추정] | 로그인 필요라 위험 낮음 |
| 캐시 | `/s/[token]`은 `await connection()`으로 **동적** 렌더. `'use cache'`·`generateStaticParams` 금지. 헤더는 6장(`src/proxy.ts`) | 정적 최적화·ISR 금지 |

## 9. 검증 계획 — 이 PC에 로컬 Supabase(Docker) 없음
| 층 | 내용 | 명령 | 이 PC |
|---|---|---|---|
| V1 정적 | 린트·타입·단위 테스트(토큰 생성/해시/형식 검증, Node 해시와 SQL 식의 일치 벡터, Action 입력 검증, 스키마 재검증 — Supabase는 목) | `npm run lint` · `npx tsc --noEmit` · `npm test` | 가능 |
| V2 SQL 리뷰 | 마이그레이션·RPC를 codex-reviewer(security)가 읽기로 검토: anon 직접 select 없음, search_path, grant/execute 범위, 반환 컬럼, 트리거 invoker | (리뷰) | 가능 |
| V3 DB 통합 | `npm run db:reset` 후 SQL 테스트: anon이 `share_links`·`scores` select 불가, 유효 토큰만 RPC 성공, 만료·회수·삭제 무효, 타인 악보 `score_id` insert 거부, authenticated update는 `revoked_at`만, 상한·만료 트리거, 삭제→복구 후 링크 꺼짐, 부분 유니크 | `npm run db:reset` + psql/pgTAP [추정 위치 `supabase/tests/`] | **불가(Docker 없음)** |
| V4 E2E | 생성→비로그인 창에서 열람→끄기→열람 불가 | `npm run test:e2e` | V3 환경 필요 |
- V3·V4는 Docker가 있는 환경(다른 PC/CI [추정]) 또는 원격 Supabase 개발 브랜치에서 수행. **원격 DB 적용·브랜치 생성은 비용·운영 영향이 있어 사용자 승인 후만**. V3 미실시 상태로 병합하지 않는다(실시 전 M1~M3는 "미검증" 표기, 배포 금지).
- `secscan` 의존성 변화 없음(새 의존성 없음 목표).

## 10. 수용 기준
| # | 기준 | 확인 |
|---|---|---|
| 1 | 소유자가 S02에서 링크를 만들고 복사할 수 있고, 재방문 시 원문은 보이지 않는다 | 단위+E2E |
| 2 | 비로그인 브라우저에서 `/s/[token]`으로 제목·악보·재생이 된다, 편집 UI 없음 | E2E (V4) |
| 3 | 끄기·만료·악보 `deleted_at`·잘못된 토큰이 **같은 화면/응답** | 단위+V3 |
| 4 | `anon`이 `share_links`·`scores`를 직접 select하면 0행/거부 | V3 |
| 5 | 타인 악보 `score_id`로 insert 거부 | V3 |
| 6 | 응답에 `X-Robots-Tag: noindex`, `Cache-Control: no-store`, `Referrer-Policy: no-referrer` | 단위(헤더) |
| 7 | DB에 토큰 원문이 없다(해시만), 앱 코드 로그에 토큰이 없다 | V2 리뷰+단위 |
| 8 | 미동기화·비로그인 악보는 링크 생성 불가 안내가 뜬다 | 단위 |
| 9 | 3구간(~767/768~1199/1200~) 레이아웃·토큰만 사용 | codex-reviewer(design) |
| 10 | `npm run lint` · `npx tsc --noEmit` · `npm test` 통과 | 명령 |
| 11 | 악보 삭제→복구 후에도 링크는 꺼진 채, 상한·만료 초과 insert 거부, update는 `revoked_at`만 | V3 |

## 11. 작업 분해(제안, 순차)
| 작업 | 담당 | 쓰기 영역 | 비고 |
|---|---|---|---|
| a. 착수 전 공격 | challenger | — | 완료(본 명세에 반영) |
| b. 마이그레이션 M1~M3 | builder | `supabase/**` | V2 리뷰 후 |
| c. 토큰·Action·페이지·`src/proxy.ts` 헤더 | builder | `src/app/**`, `src/lib/**`, `src/proxy.ts` | b 이후 |
| d. 테스트 | tester | 테스트 파일 | V1 + V3 스크립트 작성(실행은 Docker 환경) |
| e. 문서 갱신 | planner | `docs/**` | 03 S01 상태, 05 확정값(`score_id` FK), 04 생성, **`01_PRD.md#8`의 작성자 표시명·토큰 컬럼 RLS 문구를 본 명세(비노출·select 정책 없음·해시만)에 맞게 정정** |

## 12. 결정 필요
| # | 질문 | 제안 | 결정자 | 결정 |
|---|---|---|---|---|
| 1 | 익명 읽기 경로 A(RPC) vs B | A | 팀장 | **결정(팀장 2026-11-02): A** — security definer RPC만, anon 테이블 select 없음 |
| 2 | `share_links` 재사용(`target_type`+FK 없음) vs `score_id` FK 유지 | 재사용 | 팀장 | **결정: FK 유지** — `score_id` FK(on delete cascade) + 콘티 때 nullable `setlist_id` 추가·정확히 하나 check. 무결성·삭제 연쇄 때문에 재사용안 기각 |
| 3 | 실시간 vs 스냅샷 | 실시간 | 팀장 | **결정: 실시간** |
| 4 | 보안 레벨 L2 확정(`01#8`) | L2 | 팀장 | **결정: L2** |
| 5 | 레이트 리밋 수치·구현 위치 | 8장 | 팀장 | **결정: 8장 제안값**, 구현 위치는 배포 설정(Vercel 방화벽) — 배포 단계 체크리스트 |
| 6 | 활성 링크 상한·만료일 최대 | 200개 / 1년 [미확인] | 팀장 | **결정: 소유자당 활성 200개, 만료 기본 없음·선택 최대 1년** (DB 트리거 강제) |
| 7 | 소유자 표시명 노출 | 비노출 | 팀장(기본)→사용자 | **결정: 비노출** |
| 8 | 공유 링크 무료/Pro 경계 | 미정(`01#4`: 공유는 Pro 묶음안) | 사용자 | **잠정(팀장): 무료로 구현**, Pro 경계는 결제 기능(PR01) 때 사용자 결정 — 서버 액션 한 곳에서 막을 수 있게 |
| 9 | 공유 악보 저작권 안내·신고 정책(`01#7` 6번) | 별도 | 사용자 | **보류: 공개 배포 전 사용자 결정** — 구현에는 영향 없음, S01 하단 신고 링크 자리만 |
| 10 | 원격 Supabase 개발 브랜치로 V3 수행 허용 | 필요 시 | 사용자 | **보류: DB 통합 검증 단계에서 사용자에게 묻는다**(대안: Docker 설치 후 로컬) |
| 11 | 악보 삭제→복구 시 링크 | 꺼진 채 | 팀장 | **결정(challenger B3 수용): `deleted_at` null→값 전환 때 `revoked_at = now()` 트리거** |

## 13. 수익·사업 관점
수익=Pro 묶음에 공유 포함(`01#4`) / 가장 싼 검증=베타 사용자 대상 링크 공유 이벤트 수 집계(`01#5` 콘티 공유 수와 별개) / 자동화=전부 자동 / 정부지원 연결=미확인.

## 다이어그램 요청 (diagrammer)
- 시퀀스: 소유자 S02 → Server Action(토큰 생성·해시 저장) → DB / 열람자 → `/s/[token]` → RPC `get_shared_score` → 단일 무효 응답 분기.
