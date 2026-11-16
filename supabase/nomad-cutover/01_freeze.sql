-- humscore 운영 데이터 이관 1단계: 옛 public 표 쓰기 동결 (사람이 1회 실행, 마이그레이션 아님)
-- 실행: psql "<DB 주소>" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/01_freeze.sql
-- 하는 일: public.scores·setlists·share_links·transcription_jobs 의 insert·update·delete 권한(열 단위 포함)을
--   anon·authenticated·service_role 에서 회수하고, 회수 전 권한을 nomad_cutover_humscore.frozen_grants 에 적는다.
--   되돌리기는 01_freeze_undo.sql(적어 둔 권한을 그대로 다시 준다). 표·함수·데이터는 건드리지 않는다.
-- pg_cron · auth.users 트리거: humscore 옛 마이그레이션에는 없다. 운영에 손으로 만든 것이 있으면 중단하고 사람이 판단한다.
begin;

do $$
declare
  v_list text;
begin
  if to_regnamespace('nomad_cutover_humscore') is not null then
    raise exception '이미 동결됨(nomad_cutover_humscore 있음). 다시 동결하려면 01_freeze_undo.sql 을 먼저 실행';
  end if;
  if to_regclass('public.scores') is null or to_regclass('public.setlists') is null
     or to_regclass('public.share_links') is null or to_regclass('public.transcription_jobs') is null then
    raise exception '옛 public 표 4개(scores·setlists·share_links·transcription_jobs) 중 없는 것이 있다 — 대상 DB 확인';
  end if;
  select string_agg(t.tgname, ', ') into v_list
  from pg_catalog.pg_trigger t
  where t.tgrelid = 'auth.users'::regclass and not t.tgisinternal
    and t.tgname !~ '^nomad_';  -- 새 nomad 마이그레이션(accounts)이 만든 가입 트리거는 옛 것이 아니다
  if v_list is not null then
    raise exception 'auth.users 에 예상 밖 트리거가 있다(%) — 끌지 사람이 판단한 뒤 진행', v_list;
  end if;
  if to_regclass('cron.job') is not null then
    execute $q$select string_agg(jobname || '#' || jobid, ', ') from cron.job
               where command ~* '(scores|setlists|share_links|transcription_jobs)'$q$ into v_list;
    if v_list is not null then
      raise exception '옛 표를 쓰는 pg_cron 작업이 있다(%) — 끌지 사람이 판단한 뒤 진행', v_list;
    end if;
  end if;
end $$;

create schema nomad_cutover_humscore;
revoke all on schema nomad_cutover_humscore from public, anon, authenticated, service_role;
comment on schema nomad_cutover_humscore is 'humscore 데이터 이관 작업 기록(01_freeze). API 노출 금지. 이관 확정 후 drop 가능';

create table nomad_cutover_humscore.frozen_grants (
  table_name   text not null,
  column_name  text,                -- null = 표 단위 권한
  grantee      text not null,
  privilege    text not null check (privilege in ('INSERT', 'UPDATE', 'DELETE')),
  grantable    boolean not null,
  frozen_at    timestamptz not null default now()
);
alter table nomad_cutover_humscore.frozen_grants enable row level security;
revoke all on nomad_cutover_humscore.frozen_grants from public, anon, authenticated, service_role;

-- 회수 전 권한 기록(표 단위 + 열 단위)
insert into nomad_cutover_humscore.frozen_grants (table_name, column_name, grantee, privilege, grantable)
select c.relname, null, r.rolname, a.privilege_type, a.is_grantable
from pg_catalog.pg_class c
cross join lateral pg_catalog.aclexplode(c.relacl) a
join pg_catalog.pg_roles r on r.oid = a.grantee
where c.oid in ('public.scores'::regclass, 'public.setlists'::regclass,
                'public.share_links'::regclass, 'public.transcription_jobs'::regclass)
  and r.rolname in ('anon', 'authenticated', 'service_role')
  and a.privilege_type in ('INSERT', 'UPDATE', 'DELETE')
union all
select c.relname, att.attname, r.rolname, a.privilege_type, a.is_grantable
from pg_catalog.pg_class c
join pg_catalog.pg_attribute att on att.attrelid = c.oid and att.attnum > 0 and not att.attisdropped
cross join lateral pg_catalog.aclexplode(att.attacl) a
join pg_catalog.pg_roles r on r.oid = a.grantee
where c.oid in ('public.scores'::regclass, 'public.setlists'::regclass,
                'public.share_links'::regclass, 'public.transcription_jobs'::regclass)
  and r.rolname in ('anon', 'authenticated', 'service_role')
  and a.privilege_type in ('INSERT', 'UPDATE');

-- 표 단위 회수는 같은 종류의 열 단위 권한도 함께 회수한다
revoke insert, update, delete on public.scores, public.setlists, public.share_links, public.transcription_jobs
  from anon, authenticated, service_role;

-- 확인: 세 역할 누구도(PUBLIC 경유 포함) 옛 표에 쓸 수 없어야 한다
do $$
declare
  v_bad text;
begin
  select string_agg(r || ':' || t || ':' || p, ', ') into v_bad
  from unnest(array['anon', 'authenticated', 'service_role']) r
  cross join unnest(array['public.scores', 'public.setlists', 'public.share_links', 'public.transcription_jobs']) t
  cross join unnest(array['INSERT', 'UPDATE', 'DELETE']) p
  where pg_catalog.has_table_privilege(r, t, p)
     or (p <> 'DELETE' and pg_catalog.has_any_column_privilege(r, t, p));
  if v_bad is not null then
    raise exception '동결 실패: 아직 쓸 수 있는 권한(%) — PUBLIC 권한 등 확인', v_bad;
  end if;
  raise notice '동결 완료: 기록한 권한 %건', (select count(*) from nomad_cutover_humscore.frozen_grants);
end $$;

commit;
