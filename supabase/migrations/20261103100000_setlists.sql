-- HumScore task-020: 찬양 콘티(세트리스트) — 테이블·check·트리거·RLS
-- 서버 전용 + CAS 동기화: updated_at 은 트리거가 insert·update 마다 서버 now() 로 덮어쓴다(클라이언트 값 무시).
-- 원본 scores 는 읽기만 한다(콘티 저장이 scores 를 바꾸는 경로 없음).
-- 콘티 링크 회수 트리거(setlists_d_revoke_shares)는 share_links.setlist_id 가 생기는 20261103100100 에서 만든다.

-- ===== items 형태 검사 (check 제약용, 순수 함수) =====
-- 배열 50곡 이하, 원소는 허용 키만 가진 객체:
--   scoreId uuid 문자열 / transpose 정수 -24~24 / bpm null 또는 1~400
--   form ≤200자 / note ≤500자 / transition ≤300자 (각각 null 또는 문자열)
create or replace function public.setlist_items_valid(p_items jsonb) returns boolean
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

-- ===== setlists =====
create table public.setlists (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  title         text not null check (char_length(title) <= 100),
  service_date  date not null,
  memo          text check (memo is null or char_length(memo) <= 1000),
  share_notes   boolean not null default true,
  items         jsonb not null default '[]'::jsonb
                check (public.setlist_items_valid(items) and octet_length(items::text) <= 65536),
  -- C01 곡 수 표시용 (items 는 check 로 항상 배열)
  item_count    integer generated always as (
                  case when jsonb_typeof(items) = 'array' then jsonb_array_length(items) else 0 end
                ) stored,
  updated_at    timestamptz not null default now(),
  deleted_at    timestamptz,
  created_at    timestamptz not null default now()
);

comment on table public.setlists is '찬양 콘티 — 소유자만 접근, items jsonb(순서=배열 순서), updated_at 은 서버 now()(CAS 기준), 익명 열람은 get_shared_setlist RPC 로만';

create index setlists_user_date_idx on public.setlists (user_id, service_date desc);

alter table public.setlists enable row level security;

create policy "setlists: owner can read" on public.setlists
  for select using ((select auth.uid()) = user_id);
create policy "setlists: owner can insert" on public.setlists
  for insert with check ((select auth.uid()) = user_id);
create policy "setlists: owner can update" on public.setlists
  for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
-- 앱 삭제는 deleted_at(UPDATE). 하드 DELETE 는 계정 정리용.
create policy "setlists: owner can delete" on public.setlists
  for delete using ((select auth.uid()) = user_id);

revoke all on public.setlists from anon;

-- ===== 트리거 (이름 순 실행: a → b → c) =====
-- (a) CAS 기준 시각: 클라이언트가 보낸 updated_at 은 무시하고 서버 now() 로 덮어쓴다
create or replace function public.setlists_touch() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  new.updated_at := pg_catalog.now();
  return new;
end;
$$;

drop trigger if exists setlists_a_touch on public.setlists;
create trigger setlists_a_touch
  before insert or update on public.setlists
  for each row execute function public.setlists_touch();

-- (b) 사용자당 살아있는 콘티 2000개 (insert 시)
create or replace function public.setlists_row_cap() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.deleted_at is null then
    -- 같은 사용자의 동시 insert 가 상한을 넘지 않도록 트랜잭션 단위로 직렬화
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext('setlists:' || new.user_id::text));
    if (select pg_catalog.count(*) from public.setlists where user_id = new.user_id and deleted_at is null) >= 2000 then
      raise exception 'setlist limit reached (2000)' using errcode = '53400';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists setlists_b_row_cap on public.setlists;
create trigger setlists_b_row_cap
  before insert on public.setlists
  for each row execute function public.setlists_row_cap();

-- (c) 소유 확인(긍정형): items 의 모든 원소가 uuid 형식 scoreId 이고,
--     각각 콘티 소유자(new.user_id)의 삭제되지 않은 scores 행이 있어야 통과. 하나라도 아니면 23514.
create or replace function public.setlists_items_owner() returns trigger
language plpgsql security invoker set search_path = '' as $$
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
      select 1 from public.scores s
      where s.id = (e.v ->> 'scoreId')::uuid
        and s.user_id = new.user_id
        and s.deleted_at is null
    );
  if v_owned <> v_total then
    raise exception 'setlist items must reference own live scores' using errcode = '23514';
  end if;
  return new;
end;
$$;

drop trigger if exists setlists_c_items_owner on public.setlists;
create trigger setlists_c_items_owner
  before insert or update of items, user_id on public.setlists
  for each row execute function public.setlists_items_owner();

revoke all on function public.setlists_touch() from public, anon, authenticated;
revoke all on function public.setlists_row_cap() from public, anon, authenticated;
revoke all on function public.setlists_items_owner() from public, anon, authenticated;
