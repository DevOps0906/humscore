# 05. 데이터 모델 변경안 (초안)

> 기존: `scores`, `transcription_jobs`(마이그레이션 `20261019211413_scores.sql`). ERD는 `sql2erd`로 `diagrams/erd.mmd` 생성(손으로 그리지 않음).
> 모두 새 마이그레이션 파일로 추가. 정책은 `(select auth.uid())` 형태, 정책 컬럼 인덱스 필수.

## 테이블 목록 (화면 표 `데이터` 칸은 이 이름만 쓴다)
| 테이블 | 상태 | 목적 | RLS 기준 | 비고 |
|---|---|---|---|---|
| scores | 구현 | 악보(`Score`) 저장·동기화 | 소유자 `user_id` | `deleted_at` 추가됨(`20261019212458`). 기기 저장분은 로컬이며 로그인 시 동기화 |
| transcription_jobs | 구현 | 변환 작업 기록 | 소유자 `user_id`, insert는 `status='queued'`만 | `20261019211413` |
| folders | 계획 | 악보 폴더 | 소유자 | 아래 `## folders` |
| tags | 계획 | 악보 태그 | 소유자 | 아래 `## tags · score_tags` |
| score_tags | 계획 | 악보-태그 연결 | 악보·태그 모두 소유자 | 〃 |
| share_links | 구현 중 | 공유 링크(해시 토큰) | 소유자 `owner_id`, 익명은 `get_shared_score` RPC로만 | 아래 `## share_links` |
| youtube_sources | 계획 | 유튜브 출처 URL·제목 | 소유자 | 아래 `## youtube_sources` |
| setlists | 계획 | 찬양 콘티 | 소유자 | 아래 `## setlists · setlist_items` |
| setlist_items | 계획 | 콘티 곡 항목 | 부모 콘티 소유자 | 〃 |

## Score 타입 변경 여부
`src/lib/music/types.ts`의 `Score`: **변경 없음**(폴더·태그·공유·출처는 별도 테이블/컬럼). 단, `scores.folder_id` 컬럼 추가는 DB 변경 — 클라이언트 동기화 코드 영향 여부는 **팀장 결정 필요**.

## folders
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | 기본 gen_random_uuid() |
| user_id | uuid FK auth.users, not null | 인덱스 |
| name | text not null | 사용자당 중복 불가 |
| created_at | timestamptz | |
- RLS: 소유자(`user_id = auth.uid()`)만 select·insert·update·delete.
- 변경: `scores.folder_id uuid null references folders(id) on delete set null` 추가. 기존 scores 정책(소유자만)으로 충분하되, insert/update 시 folder_id가 본인 폴더인지 `with check`로 확인.

## tags · score_tags
| 테이블 | 컬럼 | 비고 |
|---|---|---|
| tags | id uuid PK, user_id FK, name text, created_at | (user_id, name) 유니크 |
| score_tags | score_id FK scores, tag_id FK tags, PK(score_id, tag_id) | 인덱스 tag_id |
- RLS tags: 소유자만 전 작업.
- RLS score_tags: 해당 score와 tag가 모두 본인 소유일 때만 select·insert·delete(`exists`로 scores.user_id·tags.user_id 확인). update 없음.

## share_links
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| score_id | uuid not null FK scores on delete cascade | 인덱스. 콘티 때 nullable `setlist_id` 추가 |
| owner_id | uuid not null FK auth.users | 인덱스 |
| token_hash | text unique not null | sha256 hex 64자. 원문 미저장(생성·형식은 [명세](specs/task-019-share-link.md) 4장) |
| expires_at | timestamptz null | 미설정=무기한, 설정 시 최대 1년 |
| revoked_at | timestamptz null | 공유 끄기 |
| created_at | timestamptz | |
- 부분 유니크: 악보당 활성 1개(`score_id` where `revoked_at is null`).
- RLS: 소유자(`owner_id = (select auth.uid())`)만 select·delete. insert는 `score_id`가 본인 미삭제 악보일 때만(`with check`). update는 `revoked_at` 컬럼 권한만. **anon 정책 없음.**
- 트리거(`security invoker`): 소유자당 활성 200개·만료 ≤ 1년(before insert) / `scores.deleted_at` null→값 시 `revoked_at = now()`(복구해도 꺼진 채).
- 익명 열람: `get_shared_score` RPC 한 곳(`title`·`data`만, 무효는 모두 빈 결과). 인터페이스는 `04_API.md#공유 링크`. 소유자 표시명 비노출(결정).
- 악보 수정은 공유본에 즉시 반영(실시간 결정).

## youtube_sources
| 컬럼 | 타입 | 비고 |
|---|---|---|
| id | uuid PK | |
| score_id | uuid FK scores on delete cascade, unique | 인덱스 |
| user_id | uuid FK auth.users | 인덱스 |
| url | text not null | 유튜브 URL(형식 검사) |
| title | text null | 영상 제목만 |
| created_at | timestamptz | |
- 저장하지 않음: 오디오, 썸네일, 채널 정보, 영상 길이 외 메타([ADR 0001](adr/0001-youtube-tab-capture.md)).
- RLS: 소유자만 select·insert·update·delete. insert 시 score_id가 본인 악보인지 `with check` 확인.
- 공유 링크로 악보를 볼 때 출처 URL은 비노출(task-019 명세 4장).

## setlists · setlist_items (찬양 콘티)
| 테이블 | 컬럼 | 비고 |
|---|---|---|
| setlists | id uuid PK, user_id FK auth.users, title text not null, service_date date, memo text, created_at, updated_at | 인덱스 (user_id, service_date desc) |
| setlist_items | id uuid PK, setlist_id FK setlists on delete cascade, score_id FK scores, position int, transpose int, tempo int null, form text null, memo text, transition_memo text | 인덱스 setlist_id; 유니크 (setlist_id, position) |
- 키는 `transpose` 값만 저장, 원본 악보 불변. `form`은 진행 순서 문자열(예: "V1-C-V2-C-B-C"). 인도자 멘트는 `setlists.memo`와 `setlist_items.memo` 중 어디에 둘지는 팀장 결정 필요(기본: 곡별 `memo`=곡 메모, 멘트는 `setlists.memo`).
- RLS setlists: 소유자(`user_id = auth.uid()`)만 select·insert·update·delete.
- RLS setlist_items: 부모 setlist가 본인 소유(`exists`)이고 `score_id`가 본인 악보일 때만 select·insert·update·delete(`with check` 포함).
- `Score` 타입 변경 없음. 삭제된 악보는 `score_id` FK `on delete restrict` 또는 `set null`(표시용) — **팀장 결정 필요**.
- 공유: `share_links`에 nullable `setlist_id` FK 추가 + "`score_id`·`setlist_id` 중 정확히 하나" check(결정: task-019 명세 12장 #2, 새 마이그레이션). 익명 열람 RPC는 콘티 도입 때 대상별로 곡 목록(제목·키·템포·진행·악보 data)을 반환하도록 확장.

## 확인 필요
- `미확인`: 폴더·태그 개수 상한(남용 방지), 공유 링크 조회 횟수 제한.
