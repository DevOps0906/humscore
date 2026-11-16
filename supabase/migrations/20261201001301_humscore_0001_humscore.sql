-- HumScore · 개인형(user안) · 원본: humscore 레포 supabase/migrations 5개(scores·transcription_jobs·share_links·setlists) 최종 상태 통합
-- 소유 = auth.users(user_id). 전제: nomad_core.touch_updated_at()(task-011). 되돌림: drop schema nomad_humscore cascade; drop schema nomad_humscore_private cascade;
-- 앱 호출 시 supabase-js 는 .schema('nomad_humscore') 로 지정한다(API 노출 스키마에 nomad_humscore 추가, _private 는 노출 금지).
begin;

create schema nomad_humscore;
create schema nomad_humscore_private;
revoke all on schema nomad_humscore, nomad_humscore_private from public;
grant usage on schema nomad_humscore to anon, authenticated, service_role;
-- check 제약이 함수를 호출하므로 private 도 usage 만 연다(테이블·함수 권한은 개별 부여)
grant usage on schema nomad_humscore_private to authenticated, service_role;

-- ===== 순수 검사 함수: setlists.items 형태 =====
-- 배열 50곡 이하, 원소는 허용 키만 가진 객체(scoreId uuid · transpose -24~24 정수 · bpm null|1~400 · form≤200 · note≤500 · transition≤300)
create function nomad_humscore_private.setlist_items_valid(p_items jsonb) returns boolean
language sql immutable set search_path = '' as $$
  select case
    when p_items is null or pg_catalog.jsonb_typeof(p_items) <> 'array' then false
    when pg_catalog.jsonb_array_length(p_items) > 50 then false
    else not exists (
      select 1 from pg_catalog.jsonb_array_elements(p_items) as e(v)
      where not coalesce(
        case
          when pg_catalog.jsonb_typeof(e.v) <> 'object' then false
          else
            not exists (
              select 1 from pg_catalog.jsonb_object_keys(e.v) as k(key)
              where k.key not in ('scoreId', 'transpose', 'bpm', 'form', 'note', 'transition')
            )
            and pg_catalog.jsonb_typeof(e.v -> 'scoreId') = 'string'
            and (e.v ->> 'scoreId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
            and pg_catalog.jsonb_typeof(e.v -> 'transpose') = 'number'
            and (case when pg_catalog.jsonb_typeof(e.v -> 'transpose') = 'number' then
                   (e.v ->> 'transpose')::numeric between -24 and 24
                   and (e.v ->> 'transpose')::numeric = pg_catalog.trunc((e.v ->> 'transpose')::numeric)
                 else false end)
            and (case coalesce(pg_catalog.jsonb_typeof(e.v -> 'bpm'), 'null')
                   when 'null' then true
                   when 'number' then (e.v ->> 'bpm')::numeric between 1 and 400
                   else false end)
            and (case coalesce(pg_catalog.jsonb_typeof(e.v -> 'form'), 'null')
                   when 'null' then true
                   when 'string' then pg_catalog.char_length(e.v ->> 'form') <= 200
                   else false end)
            and (case coalesce(pg_catalog.jsonb_typeof(e.v -> 'note'), 'null')
                   when 'null' then true
                   when 'string' then pg_catalog.char_length(e.v ->> 'note') <= 500
                   else false end)
            and (case coalesce(pg_catalog.jsonb_typeof(e.v -> 'transition'), 'null')
                   when 'null' then true
                   when 'string' then pg_catalog.char_length(e.v ->> 'transition') <= 300
                   else false end)
        end, false)
    )
  end
$$;

-- ===== 테이블 =====
create table nomad_humscore.scores (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  data        jsonb not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  deleted_at  timestamptz
);
create index scores_user_updated_idx on nomad_humscore.scores (user_id, updated_at desc);
create index scores_user_deleted_idx on nomad_humscore.scores (user_id, deleted_at);
comment on table nomad_humscore.scores is '악보(Score 객체 전체 jsonb) — 소유자만 접근, 소프트 삭제, 클라이언트 updated_at 기준 LWW 동기화';

create table nomad_humscore.setlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) <= 100),
  service_date  date not null,
  memo          text check (memo is null or char_length(memo) <= 1000),
  share_notes   boolean not null default true,
  items         jsonb not null default '[]'::jsonb
                check (nomad_humscore_private.setlist_items_valid(items) and octet_length(items::text) <= 65536),
  item_count    integer generated always as (
                  case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) else 0 end
                ) stored,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);
create index setlists_user_date_idx on nomad_humscore.setlists (user_id, service_date desc);
create index setlists_user_updated_idx on nomad_humscore.setlists (user_id, updated_at);
comment on table nomad_humscore.setlists is '찬양 콘티 — 소유자만 접근, items jsonb(순서=배열 순서), updated_at 은 서버 now()';

create table nomad_humscore.share_links (
  id          uuid primary key default gen_random_uuid(),
  score_id    uuid references nomad_humscore.scores (id) on delete cascade,
  setlist_id  uuid references nomad_humscore.setlists (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now(),
  constraint share_links_one_target check (num_nonnulls(score_id, setlist_id) = 1)
);
create index share_links_owner_idx on nomad_humscore.share_links (owner_id);
create index share_links_score_idx on nomad_humscore.share_links (score_id);
create index share_links_setlist_idx on nomad_humscore.share_links (setlist_id);
create unique index share_links_one_active_idx on nomad_humscore.share_links (score_id) where revoked_at is null;
create unique index share_links_one_active_setlist_idx on nomad_humscore.share_links (setlist_id) where revoked_at is null;
comment on table nomad_humscore.share_links is '악보·콘티 읽기 전용 공유 링크 — 토큰 해시만 저장, 익명 열람은 get_shared_score/get_shared_setlist RPC 로만';

create table nomad_humscore.transcription_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('separate', 'transcribe_multi', 'arrange')),
  status      text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  input_path  text,
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index transcription_jobs_user_idx on nomad_humscore.transcription_jobs (user_id, created_at desc);
comment on table nomad_humscore.transcription_jobs is '변환 작업 큐 — 사용자는 queued 로 등록만, 상태 갱신은 워커(service_role)';

-- ===== 트리거 함수(private, security invoker) =====
create function nomad_humscore_private.scores_clamp_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at > pg_catalog.now() + interval '5 minutes' then
    new.updated_at := pg_catalog.now();
  end if;
  if new.deleted_at is not null and new.deleted_at > pg_catalog.now() + interval '5 minutes' then
    new.deleted_at := pg_catalog.now();
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.scores_lww_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.scores_row_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null
     and not exists (select 1 from nomad_humscore.scores where id = new.id)
     and (select pg_catalog.count(*) from nomad_humscore.scores where user_id = new.user_id and deleted_at is null) >= 2000 then
    raise exception 'score limit reached (2000)' using errcode = '53400';
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.scores_revoke_shares() returns trigger
language plpgsql set search_path = '' as $$
begin
  update nomad_humscore.share_links set revoked_at = pg_catalog.now()
  where score_id = new.id and revoked_at is null;
  return null;
end;
$$;

create function nomad_humscore_private.setlists_row_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null then
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('setlists:' || new.user_id::text));
    if (select pg_catalog.count(*) from nomad_humscore.setlists where user_id = new.user_id and deleted_at is null) >= 2000 then
      raise exception 'setlist limit reached (2000)' using errcode = '53400';
    end if;
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.setlists_items_owner() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_total integer;
  v_owned integer;
begin
  if new.items is null or pg_catalog.jsonb_typeof(new.items) <> 'array' then
    raise exception 'setlist items must be an array' using errcode = '23514';
  end if;
  v_total := pg_catalog.jsonb_array_length(new.items);
  select pg_catalog.count(*) into v_owned
  from pg_catalog.jsonb_array_elements(new.items) as e(v)
  where (e.v ->> 'scoreId') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
    and exists (
      select 1 from nomad_humscore.scores s
      where s.id = (e.v ->> 'scoreId')::uuid and s.user_id = new.user_id and s.deleted_at is null
    );
  if v_owned <> v_total then
    raise exception 'setlist items must reference own live scores' using errcode = '23514';
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.setlists_revoke_shares() returns trigger
language plpgsql set search_path = '' as $$
begin
  update nomad_humscore.share_links set revoked_at = pg_catalog.now()
  where setlist_id = new.id and revoked_at is null;
  return null;
end;
$$;

create function nomad_humscore_private.share_links_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.expires_at is not null
     and (new.expires_at <= pg_catalog.now() or new.expires_at > pg_catalog.now() + interval '1 year') then
    raise exception 'invalid expires_at' using errcode = '22023';
  end if;
  if new.revoked_at is not null then
    raise exception 'revoked_at must be null on insert' using errcode = '22023';
  end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.owner_id::text));
  if (
       select pg_catalog.count(*) from nomad_humscore.share_links
       where owner_id = new.owner_id and revoked_at is null
         and (expires_at is null or expires_at > pg_catalog.now())
     ) >= 200 then
    raise exception 'share link limit reached (200)' using errcode = '53400';
  end if;
  return new;
end;
$$;

create function nomad_humscore_private.share_links_no_revive() returns trigger
language plpgsql set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked share link cannot be changed' using errcode = '22023';
  end if;
  return new;
end;
$$;

-- 트리거 (이름 순 실행). scores 는 클라이언트 updated_at 이 LWW 키라서 touch_updated_at 을 쓰지 않는다.
create trigger scores_a_clamp before insert or update on nomad_humscore.scores
  for each row execute function nomad_humscore_private.scores_clamp_updated_at();
create trigger scores_b_lww before update on nomad_humscore.scores
  for each row execute function nomad_humscore_private.scores_lww_guard();
create trigger scores_c_row_cap before insert on nomad_humscore.scores
  for each row execute function nomad_humscore_private.scores_row_cap();
create trigger scores_d_revoke_shares after update of deleted_at on nomad_humscore.scores
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function nomad_humscore_private.scores_revoke_shares();

create trigger setlists_a_touch before insert or update on nomad_humscore.setlists
  for each row execute function nomad_core.touch_updated_at();
create trigger setlists_b_row_cap before insert on nomad_humscore.setlists
  for each row execute function nomad_humscore_private.setlists_row_cap();
create trigger setlists_c_items_owner before insert or update of items, user_id on nomad_humscore.setlists
  for each row execute function nomad_humscore_private.setlists_items_owner();
create trigger setlists_d_revoke_shares after update of deleted_at on nomad_humscore.setlists
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function nomad_humscore_private.setlists_revoke_shares();

create trigger share_links_a_guard before insert on nomad_humscore.share_links
  for each row execute function nomad_humscore_private.share_links_guard();
create trigger share_links_b_no_revive before update on nomad_humscore.share_links
  for each row execute function nomad_humscore_private.share_links_no_revive();

create trigger jobs_a_touch before update on nomad_humscore.transcription_jobs
  for each row execute function nomad_core.touch_updated_at();

-- ===== RLS =====
alter table nomad_humscore.scores enable row level security;
alter table nomad_humscore.setlists enable row level security;
alter table nomad_humscore.share_links enable row level security;
alter table nomad_humscore.transcription_jobs enable row level security;

create policy scores_select on nomad_humscore.scores for select to authenticated using ((select auth.uid()) = user_id);
create policy scores_insert on nomad_humscore.scores for insert to authenticated with check ((select auth.uid()) = user_id);
create policy scores_update on nomad_humscore.scores for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy scores_delete on nomad_humscore.scores for delete to authenticated using ((select auth.uid()) = user_id);

create policy setlists_select on nomad_humscore.setlists for select to authenticated using ((select auth.uid()) = user_id);
create policy setlists_insert on nomad_humscore.setlists for insert to authenticated with check ((select auth.uid()) = user_id);
create policy setlists_update on nomad_humscore.setlists for update to authenticated using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy setlists_delete on nomad_humscore.setlists for delete to authenticated using ((select auth.uid()) = user_id);

create policy share_links_select on nomad_humscore.share_links for select to authenticated using ((select auth.uid()) = owner_id);
create policy share_links_delete on nomad_humscore.share_links for delete to authenticated using ((select auth.uid()) = owner_id);
create policy share_links_update on nomad_humscore.share_links for update to authenticated
  using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);
create policy share_links_insert on nomad_humscore.share_links for insert to authenticated with check (
  owner_id = (select auth.uid())
  and (
    (score_id is not null and exists (
      select 1 from nomad_humscore.scores s
      where s.id = score_id and s.user_id = (select auth.uid()) and s.deleted_at is null))
    or
    (setlist_id is not null and exists (
      select 1 from nomad_humscore.setlists l
      where l.id = setlist_id and l.user_id = (select auth.uid()) and l.deleted_at is null))
  )
);

-- 상태 변경은 워커(service_role)만 → update 정책 없음
create policy jobs_select on nomad_humscore.transcription_jobs for select to authenticated using ((select auth.uid()) = user_id);
create policy jobs_insert on nomad_humscore.transcription_jobs for insert to authenticated
  with check ((select auth.uid()) = user_id and status = 'queued');

-- ===== 익명·소유자 RPC (이름 유지) =====
create function nomad_humscore.get_shared_score(p_token text)
returns table (title text, data jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return;
  end if;
  return query
    select s.title, s.data
    from nomad_humscore.share_links sl
    join nomad_humscore.scores s on s.id = sl.score_id and s.user_id = sl.owner_id
    where sl.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > pg_catalog.now())
      and s.deleted_at is null
    limit 1;
end;
$$;

create function nomad_humscore.get_shared_setlist(p_token text)
returns table (title text, service_date date, memo text, items jsonb, scores jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_sl nomad_humscore.setlists%rowtype;
  v_items jsonb;
  v_scores jsonb := '[]'::jsonb;
  v_total bigint := 0;
  r record;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return;
  end if;

  select l.* into v_sl
  from nomad_humscore.share_links sl
  join nomad_humscore.setlists l on l.id = sl.setlist_id and l.user_id = sl.owner_id
  where sl.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
    and sl.revoked_at is null
    and (sl.expires_at is null or sl.expires_at > pg_catalog.now())
    and l.deleted_at is null
  limit 1;
  if not found then
    return;
  end if;

  select coalesce(pg_catalog.jsonb_agg(
           pg_catalog.jsonb_build_object(
             'scoreId', e.v -> 'scoreId', 'transpose', e.v -> 'transpose',
             'bpm', e.v -> 'bpm', 'form', e.v -> 'form'
           )
           || case when v_sl.share_notes
                then pg_catalog.jsonb_build_object('note', e.v -> 'note', 'transition', e.v -> 'transition')
                else '{}'::jsonb end
           order by e.ord), '[]'::jsonb)
    into v_items
  from pg_catalog.jsonb_array_elements(v_sl.items) with ordinality as e(v, ord);

  for r in
    select s.id as sid, s.title as stitle, s.data as sdata, pg_catalog.octet_length(s.data::text) as size
    from (
      select e.v ->> 'scoreId' as sid_text, pg_catalog.min(e.ord) as first_ord
      from pg_catalog.jsonb_array_elements(v_sl.items) with ordinality as e(v, ord)
      group by e.v ->> 'scoreId'
    ) x
    join nomad_humscore.scores s
      on s.id = case when x.sid_text ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                     then x.sid_text::uuid end
     and s.user_id = v_sl.user_id
     and s.deleted_at is null
    order by x.first_ord
  loop
    exit when v_total + r.size > 1048576;
    v_total := v_total + r.size;
    v_scores := v_scores || pg_catalog.jsonb_build_array(
      pg_catalog.jsonb_build_object('id', r.sid, 'title', r.stitle, 'data', r.sdata));
  end loop;

  return query select
    v_sl.title, v_sl.service_date,
    case when v_sl.share_notes then v_sl.memo else null end,
    v_items, v_scores;
end;
$$;

-- 재발급: 기존 활성 링크를 끄고 새 링크 발급(security invoker — RLS 적용)
create function nomad_humscore.reissue_share_link(p_score_id uuid, p_token_hash text, p_expires_at timestamptz default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update nomad_humscore.share_links set revoked_at = pg_catalog.now()
  where score_id = p_score_id and revoked_at is null;
  insert into nomad_humscore.share_links (score_id, owner_id, token_hash, expires_at)
  values (p_score_id, (select auth.uid()), p_token_hash, p_expires_at);
end;
$$;

-- ===== 권한 =====
revoke all on all tables in schema nomad_humscore from public, anon, authenticated;
revoke all on all functions in schema nomad_humscore from public, anon, authenticated;
revoke all on all functions in schema nomad_humscore_private from public, anon, authenticated;
grant all on all tables in schema nomad_humscore to service_role;
grant select, insert, update, delete on nomad_humscore.scores to authenticated;      -- upsert 가 전 컬럼을 갱신
grant select, insert, update, delete on nomad_humscore.setlists to authenticated;
grant select, insert, delete on nomad_humscore.share_links to authenticated;
grant update (revoked_at) on nomad_humscore.share_links to authenticated;
grant select, insert on nomad_humscore.transcription_jobs to authenticated;
grant execute on function nomad_humscore_private.setlist_items_valid(jsonb) to authenticated, service_role;
grant execute on function nomad_humscore.get_shared_score(text) to anon, authenticated, service_role;
grant execute on function nomad_humscore.get_shared_setlist(text) to anon, authenticated, service_role;
grant execute on function nomad_humscore.reissue_share_link(uuid, text, timestamptz) to authenticated, service_role;

commit;
