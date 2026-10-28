# 05. 데이터 모델 변경안 (초안)

> 기존: `scores`, `transcription_jobs`(마이그레이션 `20261019211413_scores.sql`). ERD는 `sql2erd`로 `diagrams/erd.mmd` 생성(손으로 그리지 않음).
> 모두 새 마이그레이션 파일로 추가. 정책은 `(select auth.uid())` 형태, 정책 컬럼 인덱스 필수.

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
| score_id | uuid FK scores on delete cascade | 인덱스 |
| owner_id | uuid FK auth.users | 인덱스 |
| token_hash | text unique not null | 토큰 원문은 저장 안 함(추측 불가 길이 값, 해시만) |
| expires_at | timestamptz null | 미설정=무기한 |
| revoked_at | timestamptz null | 공유 끄기 |
| created_at | timestamptz | |
- RLS: 소유자(`owner_id = auth.uid()`)만 select·insert·update·delete. insert는 `score_id`가 본인 악보일 때만.
- 익명 열람: 테이블 직접 select 정책을 열지 않는다. 토큰을 받아 해시 비교 후 악보 `title`·`data`만 반환하는 `security definer` 함수(또는 서버 전용 경로) 한 곳으로 제한 — 만료·해제는 같은 오류로 응답. **팀장 결정 필요**(함수 vs 서버 경로, 공유 토큰 길이, 악보 소유자 표시 여부).
- 악보 수정은 공유본에 즉시 반영(링크 = 현재 악보 보기). 스냅샷 방식은 미결.

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
- 공유 링크로 악보를 볼 때 출처 URL 노출 여부는 **팀장 결정 필요**(기본: 비노출).

## setlists · setlist_items (찬양 콘티)
| 테이블 | 컬럼 | 비고 |
|---|---|---|
| setlists | id uuid PK, user_id FK auth.users, title text not null, service_date date, memo text, created_at, updated_at | 인덱스 (user_id, service_date desc) |
| setlist_items | id uuid PK, setlist_id FK setlists on delete cascade, score_id FK scores, position int, transpose int, tempo int null, form text null, memo text, transition_memo text | 인덱스 setlist_id; 유니크 (setlist_id, position) |
- 키는 `transpose` 값만 저장, 원본 악보 불변. `form`은 진행 순서 문자열(예: "V1-C-V2-C-B-C"). 인도자 멘트는 `setlists.memo`와 `setlist_items.memo` 중 어디에 둘지는 팀장 결정 필요(기본: 곡별 `memo`=곡 메모, 멘트는 `setlists.memo`).
- RLS setlists: 소유자(`user_id = auth.uid()`)만 select·insert·update·delete.
- RLS setlist_items: 부모 setlist가 본인 소유(`exists`)이고 `score_id`가 본인 악보일 때만 select·insert·update·delete(`with check` 포함).
- `Score` 타입 변경 없음. 삭제된 악보는 `score_id` FK `on delete restrict` 또는 `set null`(표시용) — **팀장 결정 필요**.
- 공유: `share_links` 재사용 권장 — `target_type text check in ('score','setlist')`, `target_id uuid` 추가(기존 `score_id`는 `target_id`로 대체 또는 병행). 소유자 RLS 동일, insert 시 대상이 본인 소유인지 `with check`. 익명 열람 함수는 대상 유형별로 곡 목록(제목·키·템포·진행·악보 data)만 반환. 별도 테이블은 FK 무결성은 쉬우나 정책·함수 중복 → **팀장 결정 필요**(재사용 vs 분리).

## 확인 필요
- `미확인`: 폴더·태그 개수 상한(남용 방지), 공유 링크 조회 횟수 제한.
