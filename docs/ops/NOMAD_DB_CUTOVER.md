# humscore 운영 DB 전환 절차 (옛 public → nomad_humscore, user안)

> **repair·백업·01_freeze 를 마치기 전에는 `feat/nomad-db` 를 main 에 병합하지 않는다.** main 병합 = CI 가 `db push` 를 자동 실행하므로, 순서가 통제 밖으로 나간다.

스키마는 `supabase/migrations/` 로만 push 하고, 데이터 복사는 `supabase/nomad-cutover/` 의 psql 스크립트를 사람이 1회 실행한다. 스크립트 검사는 `bash supabase/nomad-cutover/check.sh`(로컬 일회용 DB, 합성 데이터).

## 대상
| 옛 표 (public) | 새 표 (nomad_humscore) | 비고 |
|---|---|---|
| scores · setlists · share_links · transcription_jobs | 같은 이름 | 열 이름·형 동일, id·created_at·updated_at 원본 유지 |

- 플랜: 옛 DB 에 플랜이 없다 → `nomad_core.subscriptions` 로 옮길 행 없음(구독 없음 = C 취급).
- Storage 버킷·Edge Function·pg_cron·auth.users 트리거: 없음(옛 마이그레이션 기준). 01 이 운영에 손으로 만든 것을 발견하면 중단한다.
- 익명 사용자(`auth.users.is_anonymous`) 소유 행이 하나라도 있으면 02 가 건수만 알리고 중단한다(버리지 않는다).

## 순서
`$DB` 는 운영 DB 연결 문자열(대시보드에서 복사, 저장소·로그에 남기지 않는다).

1. **백업**: 대시보드 백업 확인 + `npx supabase db dump --db-url "$DB" -f <저장소 밖>/humscore-schema.sql` 과 `--data-only` 덤프를 저장소 밖에 보관.
2. **노출 스키마 추가**(앱 배포 전): 대시보드 Settings → API → Exposed schemas 에 `nomad_humscore` 추가(`nomad_humscore_private` 는 넣지 않는다).
3. **쓰기 동결**: `psql "$DB" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/01_freeze.sql` — 옛 표의 insert·update·delete 를 anon·authenticated·service_role 에서 회수(회수한 권한은 `nomad_cutover_humscore.frozen_grants` 에 기록). 이 시점부터 옛 앱은 저장 실패(읽기는 됨). 변환 워커(레포 밖)도 멈춘다.
4. **옛 마이그레이션 기록 정리**: 옛 버전은 `supabase/legacy-migrations/` 로 옮겼으므로 원격 기록에서 뺀다.
   `npx supabase migration repair --status reverted 20261019211413 20261019212458 20261102100000 20261103100000 20261103100100 --db-url "$DB"`
   (옛 표·함수는 그대로 남는다. 기록만 지운다.)
5. **스키마 push**: `npx supabase db push --db-url "$DB"` (nomad_core + nomad_humscore 생성, 데이터 없음).
6. **복사 dry-run**: `psql "$DB" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/02_copy.sql` → `DRY-RUN (rollback)` 과 `이관 검사 통과: …` 건수 확인.
7. **복사 apply**: `psql "$DB" -v ON_ERROR_STOP=1 -v apply=true -f supabase/nomad-cutover/02_copy.sql` → `APPLIED (commit)`. 검사(행 수·행 전체 값 양방향 대조·FK 고아·링크 소유 일치) 중 하나라도 어긋나면 전체 rollback 된다.
8. **새 앱 배포**: `.schema('nomad_humscore')` 버전을 배포하고 로그인 사용자 2명 이상으로 악보 목록·콘티·공유 링크 열기를 확인.
9. **쓰기 재개**: 새 앱이 새 표에 쓰기 시작한다. 워커를 새 표 대상으로 다시 켠다.

## 되돌리기
- **되돌릴 수 없는 지점 = 9단계(쓰기 재개)**. 그 뒤로는 새 표에만 쓰이므로 옛 앱으로 돌아가면 데이터가 갈라진다(되돌리려면 새 표 → 옛 표 역복사를 따로 만들어야 함).
- 9단계 전까지:
  - 6·7단계 실패: 02 는 한 트랜잭션이라 남는 것이 없다. 원인을 고치고 6부터 다시.
  - 7단계 뒤(앱 배포 전·후) 중단: 옛 앱으로 되돌리고 `psql "$DB" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/01_freeze_undo.sql` 로 권한을 정확히 복원. 새 스키마의 복사본은 그대로 두거나(다음 시도 전 비워야 02 가 실행됨) `truncate nomad_humscore.share_links, nomad_humscore.setlists, nomad_humscore.scores, nomad_humscore.transcription_jobs;`.
  - 5단계 이후 스키마까지 되돌릴 때: `drop schema nomad_humscore cascade; drop schema nomad_humscore_private cascade;` + nomad_core 는 다른 제품이 없으면 drop, 그리고 `migration repair` 로 기록을 맞춘다.
- 옛 public 표·함수는 이관 확정 후에도 지우지 않는다(별도 작업). 기록 스키마 `nomad_cutover_humscore` 는 확정 후 drop 가능.
