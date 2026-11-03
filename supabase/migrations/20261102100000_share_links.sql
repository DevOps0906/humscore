-- HumScore task-019: 읽기 전용 공유 링크 (M1 테이블·RLS / M2 익명 읽기 RPC / M3 가드·재발급)
-- 토큰 원문은 저장하지 않는다: token_hash = sha256(UTF-8 토큰)의 소문자 hex 64자.
-- anon 은 테이블을 직접 읽을 수 없고, get_shared_score RPC 로만 (유효 토큰 1개의) 제목·데이터를 받는다.

-- ===== M1: share_links =====
create table public.share_links (
  id          uuid primary key default gen_random_uuid(),
  score_id    uuid not null references public.scores (id) on delete cascade,
  owner_id    uuid not null references auth.users (id) on delete cascade,
  token_hash  text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at  timestamptz,
  revoked_at  timestamptz,
  created_at  timestamptz not null default now()
);

comment on table public.share_links is '악보 읽기 전용 공유 링크 — 토큰 해시만 저장, 소유자만 접근, 익명 열람은 get_shared_score RPC 로만';

create index share_links_owner_idx on public.share_links (owner_id);
create index share_links_score_idx on public.share_links (score_id);
-- 악보당 활성 링크 1개
create unique index share_links_one_active_idx on public.share_links (score_id) where revoked_at is null;

alter table public.share_links enable row level security;

create policy "share_links: owner can read" on public.share_links
  for select using ((select auth.uid()) = owner_id);
create policy "share_links: owner can delete" on public.share_links
  for delete using ((select auth.uid()) = owner_id);
create policy "share_links: owner can insert" on public.share_links
  for insert with check (
    owner_id = (select auth.uid())
    and exists (
      select 1 from public.scores s
      where s.id = score_id and s.user_id = (select auth.uid()) and s.deleted_at is null
    )
  );
create policy "share_links: owner can update" on public.share_links
  for update using ((select auth.uid()) = owner_id) with check ((select auth.uid()) = owner_id);

-- 테이블 권한: anon 은 전부 없음, authenticated 의 update 는 revoked_at 컬럼만
revoke all on public.share_links from anon;
revoke update on public.share_links from authenticated;
grant update (revoked_at) on public.share_links to authenticated;

-- ===== M2: 익명 읽기 RPC =====
-- security definer: 테이블 직접 권한 없이 해시 일치 + 회수/만료/삭제 검사를 단일 WHERE 로 처리.
-- 형식이 맞지 않거나 조건에 안 맞으면 모두 0행(구분 불가). scores.user_id 는 반환하지 않는다.
create or replace function public.get_shared_score(p_token text)
returns table (title text, data jsonb)
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return;
  end if;
  return query
    select s.title, s.data
    from public.share_links sl
    join public.scores s on s.id = sl.score_id and s.user_id = sl.owner_id
    where sl.token_hash = pg_catalog.encode(pg_catalog.sha256(pg_catalog.convert_to(p_token, 'UTF8')), 'hex')
      and sl.revoked_at is null
      and (sl.expires_at is null or sl.expires_at > pg_catalog.now())
      and s.deleted_at is null
    limit 1;
end;
$$;

revoke all on function public.get_shared_score(text) from public, anon, authenticated;
grant execute on function public.get_shared_score(text) to anon, authenticated;

-- ===== M3: 가드 트리거 · 재발급 RPC =====
-- (a) 활성 링크 소유자당 200개 · 만료일은 미래 ~ 최대 1년 (before insert)
create or replace function public.share_links_guard() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if new.expires_at is not null
     and (new.expires_at <= pg_catalog.now() or new.expires_at > pg_catalog.now() + interval '1 year') then
    raise exception 'invalid expires_at' using errcode = '22023';
  end if;
  -- 회수된 상태로 insert 금지 (상한 우회 방지)
  if new.revoked_at is not null then
    raise exception 'revoked_at must be null on insert' using errcode = '22023';
  end if;
  -- 같은 소유자의 동시 insert 가 상한을 넘지 않도록 트랜잭션 단위로 직렬화
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtext(new.owner_id::text));
  if new.revoked_at is null
     and (
       select pg_catalog.count(*) from public.share_links
       where owner_id = new.owner_id
         and revoked_at is null
         and (expires_at is null or expires_at > pg_catalog.now())
     ) >= 200 then
    raise exception 'share link limit reached (200)' using errcode = '53400';
  end if;
  return new;
end;
$$;

drop trigger if exists share_links_a_guard on public.share_links;
create trigger share_links_a_guard
  before insert on public.share_links
  for each row execute function public.share_links_guard();

-- (a2) 회수된 링크 부활 금지: revoked_at 이 한 번 값이 되면 바꿀 수 없다 (null → 값만 허용)
create or replace function public.share_links_no_revive() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  if old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at then
    raise exception 'revoked share link cannot be changed' using errcode = '22023';
  end if;
  return new;
end;
$$;

drop trigger if exists share_links_b_no_revive on public.share_links;
create trigger share_links_b_no_revive
  before update on public.share_links
  for each row execute function public.share_links_no_revive();

-- (b) 악보 삭제(deleted_at null → 값) 시 같은 트랜잭션에서 링크 회수. 복구돼도 링크는 꺼진 채.
create or replace function public.scores_revoke_shares() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.share_links set revoked_at = pg_catalog.now()
  where score_id = new.id and revoked_at is null;
  return null;
end;
$$;

drop trigger if exists scores_d_revoke_shares on public.scores;
create trigger scores_d_revoke_shares
  after update of deleted_at on public.scores
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.scores_revoke_shares();

-- (c) 재발급: 기존 활성 링크를 끄고 새 링크를 한 트랜잭션에서 발급 (RLS 적용 — 소유자만)
create or replace function public.reissue_share_link(p_score_id uuid, p_token_hash text, p_expires_at timestamptz default null)
returns void
language plpgsql security invoker set search_path = '' as $$
begin
  update public.share_links set revoked_at = pg_catalog.now()
  where score_id = p_score_id and revoked_at is null;
  insert into public.share_links (score_id, owner_id, token_hash, expires_at)
  values (p_score_id, (select auth.uid()), p_token_hash, p_expires_at);
end;
$$;

revoke all on function public.share_links_guard() from public, anon, authenticated;
revoke all on function public.share_links_no_revive() from public, anon, authenticated;
revoke all on function public.scores_revoke_shares() from public, anon, authenticated;
revoke all on function public.reissue_share_link(uuid, text, timestamptz) from public, anon, authenticated;
grant execute on function public.reissue_share_link(uuid, text, timestamptz) to authenticated;
