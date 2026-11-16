-- humscore 운영 데이터 이관 2단계: 옛 public 표 → nomad_humscore (user안, 사람이 1회 실행, 마이그레이션 아님)
-- 실행(기본 dry-run = rollback): psql "<DB 주소>" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/02_copy.sql
-- 실제 반영:                    psql "<DB 주소>" -v ON_ERROR_STOP=1 -v apply=true -f supabase/nomad-cutover/02_copy.sql
-- 전제: 01_freeze.sql 실행 · 새 migrations/ push 완료. 한 트랜잭션이며 검사 하나라도 어긋나면 raise → 전체 rollback.
-- 대응: 표 4개 모두 열 이름·형이 같다(소유 컬럼 user_id·owner_id 그대로, organization_id 없음). id·created_at·updated_at 원본 유지.
-- 플랜: 옛 humscore 에 플랜 표·컬럼이 없다 → subscriptions 로 옮길 값 없음(구독 없는 조직 = C 취급, default_plan).
-- core 행: 옛 레포에 profiles·조직이 없다 → nomad_core 에 쓰는 행 없음. 시퀀스: 식별자가 모두 uuid → setval 대상 없음.
\if :{?apply}
\else
  \set apply false
\endif

begin;

-- 대상 트리거(행 수 제한·updated_at 덮어쓰기·콘티 소유 확인·링크 가드)와 FK 트리거를 이 트랜잭션에서만 끈다.
-- FK 가 꺼지므로 끝 검사에서 고아 행을 직접 확인한다.
set local session_replication_role = replica;
lock table public.scores, public.setlists, public.share_links, public.transcription_jobs in share mode;

-- ===== 시작 검사 =====
do $$
declare
  v_anon_scores bigint; v_anon_setlists bigint; v_anon_links bigint; v_anon_jobs bigint;
  v_seq text;
begin
  if pg_catalog.current_setting('session_replication_role') <> 'replica' then
    raise exception 'session_replication_role 이 replica 가 아니다 — 권한 확인(트리거가 켜진 채로 복사하면 값이 바뀐다)';
  end if;
  if to_regnamespace('nomad_cutover_humscore') is null then
    raise exception '01_freeze.sql 먼저 실행(옛 표 쓰기 동결 기록이 없다)';
  end if;

  -- 결정 2: 익명 사용자 소유 행이 있으면 건수만 알리고 중단(버리지 않는다)
  select count(*) into v_anon_scores from public.scores s join auth.users u on u.id = s.user_id where u.is_anonymous;
  select count(*) into v_anon_setlists from public.setlists s join auth.users u on u.id = s.user_id where u.is_anonymous;
  select count(*) into v_anon_links from public.share_links s join auth.users u on u.id = s.owner_id where u.is_anonymous;
  select count(*) into v_anon_jobs from public.transcription_jobs s join auth.users u on u.id = s.user_id where u.is_anonymous;
  if v_anon_scores + v_anon_setlists + v_anon_links + v_anon_jobs > 0 then
    raise exception '익명 사용자 소유 행이 있어 이관 중단: scores %, setlists %, share_links %, transcription_jobs %',
      v_anon_scores, v_anon_setlists, v_anon_links, v_anon_jobs;
  end if;

  -- 재실행 방지: 대상 표가 하나라도 비어 있지 않으면 중단
  if exists (select 1 from nomad_humscore.scores) or exists (select 1 from nomad_humscore.setlists)
     or exists (select 1 from nomad_humscore.share_links) or exists (select 1 from nomad_humscore.transcription_jobs) then
    raise exception '대상 nomad_humscore 표가 비어 있지 않다 — 이미 이관됨(재실행 거부)';
  end if;

  -- 시퀀스가 생겼다면 이 스크립트가 setval 을 빠뜨린 것이다
  select string_agg(c.relname, ', ') into v_seq from pg_catalog.pg_class c
  where c.relkind = 'S' and c.relnamespace = 'nomad_humscore'::regnamespace;
  if v_seq is not null then
    raise exception 'nomad_humscore 에 시퀀스(%)가 있다 — setval 추가 필요', v_seq;
  end if;
end $$;

-- ===== 복사 (부모 → 자식 순) =====
insert into nomad_humscore.scores (id, user_id, title, data, created_at, updated_at, deleted_at)
select id, user_id, title, data, created_at, updated_at, deleted_at from public.scores;

insert into nomad_humscore.setlists (id, user_id, title, service_date, memo, share_notes, items, updated_at, deleted_at, created_at)
select id, user_id, title, service_date, memo, share_notes, items, updated_at, deleted_at, created_at from public.setlists;

insert into nomad_humscore.share_links (id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at)
select id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at from public.share_links;

insert into nomad_humscore.transcription_jobs (id, user_id, kind, status, input_path, result, error, created_at, updated_at)
select id, user_id, kind, status, input_path, result, error, created_at, updated_at from public.transcription_jobs;

-- ===== 끝 검사 =====
do $$
declare
  v_src bigint; v_dst bigint; v_diff bigint; v_bad bigint;
begin
  -- 표마다 행 수 + 행 전체 값(소유자·id·시각 포함) 양방향 대조
  select count(*) into v_src from public.scores;
  select count(*) into v_dst from nomad_humscore.scores;
  select count(*) into v_diff from (
    (select id, user_id, title, data, created_at, updated_at, deleted_at from public.scores
     except all select id, user_id, title, data, created_at, updated_at, deleted_at from nomad_humscore.scores)
    union all
    (select id, user_id, title, data, created_at, updated_at, deleted_at from nomad_humscore.scores
     except all select id, user_id, title, data, created_at, updated_at, deleted_at from public.scores)) x;
  if v_src <> v_dst or v_diff <> 0 then
    raise exception 'scores 불일치: 원본 % / 대상 % / 다른 행 %', v_src, v_dst, v_diff;
  end if;

  select count(*) into v_src from public.setlists;
  select count(*) into v_dst from nomad_humscore.setlists;
  select count(*) into v_diff from (
    (select id, user_id, title, service_date, memo, share_notes, items, item_count, updated_at, deleted_at, created_at from public.setlists
     except all select id, user_id, title, service_date, memo, share_notes, items, item_count, updated_at, deleted_at, created_at from nomad_humscore.setlists)
    union all
    (select id, user_id, title, service_date, memo, share_notes, items, item_count, updated_at, deleted_at, created_at from nomad_humscore.setlists
     except all select id, user_id, title, service_date, memo, share_notes, items, item_count, updated_at, deleted_at, created_at from public.setlists)) x;
  if v_src <> v_dst or v_diff <> 0 then
    raise exception 'setlists 불일치: 원본 % / 대상 % / 다른 행 %', v_src, v_dst, v_diff;
  end if;

  select count(*) into v_src from public.share_links;
  select count(*) into v_dst from nomad_humscore.share_links;
  select count(*) into v_diff from (
    (select id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at from public.share_links
     except all select id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at from nomad_humscore.share_links)
    union all
    (select id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at from nomad_humscore.share_links
     except all select id, score_id, setlist_id, owner_id, token_hash, expires_at, revoked_at, created_at from public.share_links)) x;
  if v_src <> v_dst or v_diff <> 0 then
    raise exception 'share_links 불일치: 원본 % / 대상 % / 다른 행 %', v_src, v_dst, v_diff;
  end if;

  select count(*) into v_src from public.transcription_jobs;
  select count(*) into v_dst from nomad_humscore.transcription_jobs;
  select count(*) into v_diff from (
    (select id, user_id, kind, status, input_path, result, error, created_at, updated_at from public.transcription_jobs
     except all select id, user_id, kind, status, input_path, result, error, created_at, updated_at from nomad_humscore.transcription_jobs)
    union all
    (select id, user_id, kind, status, input_path, result, error, created_at, updated_at from nomad_humscore.transcription_jobs
     except all select id, user_id, kind, status, input_path, result, error, created_at, updated_at from public.transcription_jobs)) x;
  if v_src <> v_dst or v_diff <> 0 then
    raise exception 'transcription_jobs 불일치: 원본 % / 대상 % / 다른 행 %', v_src, v_dst, v_diff;
  end if;

  -- FK 고아 행(replica 로 FK 트리거가 꺼졌으므로 직접 확인)
  select (select count(*) from nomad_humscore.scores t where not exists (select 1 from auth.users u where u.id = t.user_id))
       + (select count(*) from nomad_humscore.setlists t where not exists (select 1 from auth.users u where u.id = t.user_id))
       + (select count(*) from nomad_humscore.share_links t where not exists (select 1 from auth.users u where u.id = t.owner_id))
       + (select count(*) from nomad_humscore.share_links t
          where t.score_id is not null and not exists (select 1 from nomad_humscore.scores s where s.id = t.score_id))
       + (select count(*) from nomad_humscore.share_links t
          where t.setlist_id is not null and not exists (select 1 from nomad_humscore.setlists l where l.id = t.setlist_id))
       + (select count(*) from nomad_humscore.transcription_jobs t where not exists (select 1 from auth.users u where u.id = t.user_id))
    into v_bad;
  if v_bad <> 0 then
    raise exception 'FK 고아 행 %건', v_bad;
  end if;

  -- 소유 일치(user안의 복합 FK 대응): 링크 소유자 = 대상 악보·콘티 소유자. 공유 RPC 가 이 조건으로 조인한다
  select count(*) into v_bad
  from nomad_humscore.share_links sl
  left join nomad_humscore.scores s on s.id = sl.score_id
  left join nomad_humscore.setlists l on l.id = sl.setlist_id
  where sl.owner_id is distinct from coalesce(s.user_id, l.user_id);
  if v_bad <> 0 then
    raise exception '공유 링크 소유자와 대상 소유자가 다른 행 %건', v_bad;
  end if;

  raise notice '이관 검사 통과: scores %, setlists %, share_links %, transcription_jobs %',
    (select count(*) from nomad_humscore.scores), (select count(*) from nomad_humscore.setlists),
    (select count(*) from nomad_humscore.share_links), (select count(*) from nomad_humscore.transcription_jobs);
end $$;

\if :apply
  commit;
  \echo '02_copy: APPLIED (commit)'
\else
  rollback;
  \echo '02_copy: DRY-RUN (rollback) — 반영하려면 -v apply=true'
\endif

-- set local 이 트랜잭션 밖으로 새지 않았는지 확인
do $$
begin
  if pg_catalog.current_setting('session_replication_role') <> 'origin' then
    raise exception 'session_replication_role 이 origin 으로 돌아오지 않았다';
  end if;
end $$;
