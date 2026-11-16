#!/usr/bin/env bash
# humscore 데이터 이관 스크립트 검사 (운영 DB 아님). 사용: bash supabase/nomad-cutover/check.sh
# 일회용 DB: 로컬 컨테이너 supabase_db_nomad-supabase-module 안의 cutover_humscore 만 만들고 지운다(다른 DB 는 건드리지 않음).
# 순서: auth 스키마 복제 → legacy-migrations → 합성 seed → 새 migrations → 01 → 02 dry-run → 02 apply → verify
#       → 02 재실행 거부 → 익명 행 중단 → 01_undo 권한 원복.
set -euo pipefail
D="$(cd "$(dirname "$0")" && pwd)"; S="$(cd "$D/.." && pwd)"
C=supabase_db_nomad-supabase-module; DB=cutover_humscore
T="$(mktemp -d)"; trap 'rm -rf "$T"' EXIT

pg() { docker exec -i -e PGOPTIONS=-cclient_min_messages=warning "$C" psql -U "${PGU:-postgres}" -d "$DB" -v ON_ERROR_STOP=1 -q "$@"; }
ok() { echo "  ok: $*"; }
fail() { echo "FAIL: $*" >&2; exit 1; }
# expect_fail <설명> <stderr 에 있어야 할 문구> <psql 인자...>  (stdin 은 호출 쪽에서 넘김)
expect_fail() {
  local what="$1" pat="$2"; shift 2
  if pg "$@" > "$T/out" 2> "$T/err"; then fail "$what: 실패해야 하는데 성공"; fi
  grep -q -- "$pat" "$T/err" || { cat "$T/err" >&2; fail "$what: 예상 문구($pat) 없음"; }
  ok "$what"
}
val() { pg -tA -c "$1" | tr -d '\r'; }
acl() {  # 옛 표 권한(표+열) 정렬 목록
  val "select string_agg(x, ' ' order by x) from (
         select c.relname||'.'||r.rolname||'.'||a.privilege_type||'.'||a.is_grantable x
         from pg_class c cross join lateral aclexplode(c.relacl) a join pg_roles r on r.oid = a.grantee
         where c.relnamespace = 'public'::regnamespace and c.relname in ('scores','setlists','share_links','transcription_jobs')
         union all
         select c.relname||'.'||t.attname||'.'||r.rolname||'.'||a.privilege_type||'.'||a.is_grantable
         from pg_class c join pg_attribute t on t.attrelid = c.oid and t.attnum > 0
         cross join lateral aclexplode(t.attacl) a join pg_roles r on r.oid = a.grantee
         where c.relnamespace = 'public'::regnamespace and c.relname in ('scores','setlists','share_links','transcription_jobs')) s"
}

echo "== 0. 일회용 DB $DB"
docker exec "$C" psql -U postgres -d postgres -v ON_ERROR_STOP=1 -q \
  -c "drop database if exists $DB with (force)" -c "create database $DB" > /dev/null
# Supabase 플랫폼 흉내: auth 스키마(제품 트리거 제외) 복제, extensions 스키마, public 기본 권한
docker exec "$C" sh -c "pg_dump -U supabase_admin -d postgres -s -n auth --no-publications --no-subscriptions \
  | sed '/^CREATE TRIGGER nomad_/d' | psql -U supabase_admin -d $DB -v ON_ERROR_STOP=1 -q" > /dev/null
PGU=supabase_admin pg > /dev/null <<'SQL'
create schema if not exists extensions;
grant usage on schema extensions to postgres, anon, authenticated, service_role;
create extension if not exists pgcrypto with schema extensions;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on functions to anon, authenticated, service_role;
alter default privileges for role postgres in schema public grant all on sequences to anon, authenticated, service_role;
SQL
ok "auth·extensions 준비"

echo "== 1. legacy-migrations + 합성 seed"
cat "$S"/legacy-migrations/*.sql | pg > /dev/null
PGU=supabase_admin pg < "$D/test/seed.sql" > /dev/null
ACL_BEFORE="$(acl)"
[ -n "$ACL_BEFORE" ] || fail "옛 표 권한이 비어 있다"
ok "옛 스키마·seed (scores $(val 'select count(*) from public.scores'))"

echo "== 2. 새 migrations"
cat "$S"/migrations/*.sql | pg > /dev/null
ok "nomad_core + nomad_humscore 적용"

echo "== 3. 01_freeze"
pg < "$D/01_freeze.sql" > /dev/null
expect_fail "동결 후 authenticated insert 거부" "permission denied" <<'SQL'
begin; set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
insert into public.scores (id, user_id, title, data) values (gen_random_uuid(), 'aaaaaaaa-0000-4000-8000-000000000001', 'x', '{}');
SQL
expect_fail "동결 후 service_role update 거부" "permission denied" <<'SQL'
begin; set local role service_role; update public.share_links set revoked_at = now();
SQL
expect_fail "01 두 번 실행 거부" "이미 동결됨" < "$D/01_freeze.sql"

echo "== 4. 02 dry-run"
pg < "$D/02_copy.sql" > "$T/dry" 2>&1 || { cat "$T/dry" >&2; fail "dry-run 실패"; }
grep -q "DRY-RUN" "$T/dry" || fail "dry-run 표시 없음"
[ "$(val 'select (select count(*) from nomad_humscore.scores)+(select count(*) from nomad_humscore.setlists)+(select count(*) from nomad_humscore.share_links)+(select count(*) from nomad_humscore.transcription_jobs)')" = "0" ] \
  || fail "dry-run 뒤 대상 표에 행이 남았다"
ok "dry-run 변경 없음"

echo "== 5. 02 apply + verify"
pg -v apply=true < "$D/02_copy.sql" > "$T/apply" 2>&1 || { cat "$T/apply" >&2; fail "apply 실패"; }
grep -q "APPLIED" "$T/apply" || fail "apply 표시 없음"
[ "$(val 'show session_replication_role')" = "origin" ] || fail "새 세션 session_replication_role 이 origin 이 아니다"
pg < "$D/test/verify.sql" > /dev/null
ok "값 대조·트리거 우회(set local)·RLS 격리·공유 RPC"

echo "== 6. 재실행·익명 중단"
expect_fail "02 재실행 거부" "재실행 거부" -v apply=true < "$D/02_copy.sql"
PGU=supabase_admin pg > /dev/null <<'SQL'
insert into auth.users (id, is_anonymous) values ('99999999-0000-4000-8000-000000000009', true);
insert into public.scores (id, user_id, title, data) values ('99999999-0000-4000-8000-000000000001', '99999999-0000-4000-8000-000000000009', '익명 악보', '{}');
SQL
expect_fail "익명 소유 행 있으면 중단" "익명 사용자 소유 행이 있어 이관 중단: scores 1" < "$D/02_copy.sql"
PGU=supabase_admin pg -c "delete from auth.users where id = '99999999-0000-4000-8000-000000000009'" > /dev/null

echo "== 7. 01_freeze_undo"
pg < "$D/01_freeze_undo.sql" > /dev/null
[ "$(acl)" = "$ACL_BEFORE" ] || { echo "before: $ACL_BEFORE" >&2; echo "after:  $(acl)" >&2; fail "권한이 동결 전과 다르다"; }
[ "$(val "select to_regnamespace('nomad_cutover_humscore') is null")" = "t" ] || fail "기록 스키마가 남았다"
ok "권한 원복 일치"

echo "PASS: humscore nomad-cutover check ($DB)"
