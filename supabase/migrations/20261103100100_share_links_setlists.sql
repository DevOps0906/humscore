-- HumScore task-020: share_links 를 콘티(setlists)까지 확장 + 익명 콘티 읽기 RPC
-- 링크 1개 = 악보 1개 또는 콘티 1개(num_nonnulls = 1). 활성 링크 200개 상한은 악보·콘티 합산(share_links_guard 무변경).
-- 재발급 RPC(reissue_share_link)는 악보 전용 그대로.
--
-- 롤백 SQL (spec 6.2 순서, 단 insert 정책이 setlist_id 를 참조하므로 정책 원복을 컬럼 제거보다 먼저.
-- 적용 시 새 마이그레이션 파일로 만든다. 로컬에서 트랜잭션 안 적용→재적용 확인함):
--   delete from public.share_links where setlist_id is not null;
--   drop trigger if exists setlists_d_revoke_shares on public.setlists;
--   drop function if exists public.setlists_revoke_shares();
--   drop function if exists public.get_shared_setlist(text);
--   drop policy if exists "share_links: owner can insert" on public.share_links;
--   create policy "share_links: owner can insert" on public.share_links
--     for insert with check (
--       owner_id = (select auth.uid())
--       and exists (
--         select 1 from public.scores s
--         where s.id = score_id and s.user_id = (select auth.uid()) and s.deleted_at is null
--       )
--     );
--   alter table public.share_links drop constraint if exists share_links_one_target;
--   drop index if exists public.share_links_one_active_setlist_idx;
--   drop index if exists public.share_links_setlist_idx;
--   alter table public.share_links drop column if exists setlist_id;
--   alter table public.share_links alter column score_id set not null;

-- ===== 1. 컬럼·제약·인덱스 =====
alter table public.share_links alter column score_id drop not null;
alter table public.share_links add column setlist_id uuid references public.setlists (id) on delete cascade;
alter table public.share_links add constraint share_links_one_target check (num_nonnulls(score_id, setlist_id) = 1);

create index share_links_setlist_idx on public.share_links (setlist_id);
-- 콘티당 활성 링크 1개
create unique index share_links_one_active_setlist_idx on public.share_links (setlist_id) where revoked_at is null;

comment on table public.share_links is '악보·콘티 읽기 전용 공유 링크 — 토큰 해시만 저장, 소유자만 접근, 익명 열람은 get_shared_score / get_shared_setlist RPC 로만';

-- ===== 2. insert 정책 재작성: 본인 미삭제 악보 또는 본인 미삭제 콘티 =====
drop policy if exists "share_links: owner can insert" on public.share_links;
create policy "share_links: owner can insert" on public.share_links
  for insert with check (
    owner_id = (select auth.uid())
    and (
      (score_id is not null and exists (
        select 1 from public.scores s
        where s.id = score_id and s.user_id = (select auth.uid()) and s.deleted_at is null
      ))
      or
      (setlist_id is not null and exists (
        select 1 from public.setlists l
        where l.id = setlist_id and l.user_id = (select auth.uid()) and l.deleted_at is null
      ))
    )
  );

-- ===== 3. 콘티 삭제(deleted_at null → 값) 시 같은 트랜잭션에서 링크 회수. 복구돼도 꺼진 채. =====
create or replace function public.setlists_revoke_shares() returns trigger
language plpgsql security invoker set search_path = '' as $$
begin
  update public.share_links set revoked_at = pg_catalog.now()
  where setlist_id = new.id and revoked_at is null;
  return null;
end;
$$;

drop trigger if exists setlists_d_revoke_shares on public.setlists;
create trigger setlists_d_revoke_shares
  after update of deleted_at on public.setlists
  for each row
  when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.setlists_revoke_shares();

revoke all on function public.setlists_revoke_shares() from public, anon, authenticated;

-- ===== 4. 익명 콘티 읽기 RPC =====
-- 노출 필드만 골라 반환: title, service_date, memo(share_notes 일 때만), items(scoreId·transpose·bpm·form
-- + share_notes 일 때만 note·transition), scores([{id, title, data}]).
-- user_id·deleted_at·share_notes 자체는 반환하지 않는다.
-- 포함 악보 = items 의 scoreId ∩ 콘티 소유자 ∩ 미삭제. data 합계 1MB(1048576 바이트, jsonb text 기준)를
-- 배열 순서로 누적해 넘는 곡부터 제외(클라이언트가 "볼 수 없는 곡"으로 표시).
-- 토큰 형식 불일치·회수·만료·콘티 삭제·없음 → 모두 0행.
create or replace function public.get_shared_setlist(p_token text)
returns table (title text, service_date date, memo text, items jsonb, scores jsonb)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_sl public.setlists%rowtype;
  v_items jsonb;
  v_scores jsonb := '[]'::jsonb;
  v_total bigint := 0;
  r record;
begin
  if p_token is null or p_token !~ '^[A-Za-z0-9_-]{43}$' then
    return;
  end if;

  select l.* into v_sl
  from public.share_links sl
  join public.setlists l on l.id = sl.setlist_id and l.user_id = sl.owner_id
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
             'scoreId', e.v -> 'scoreId',
             'transpose', e.v -> 'transpose',
             'bpm', e.v -> 'bpm',
             'form', e.v -> 'form'
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
    join public.scores s
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
    v_sl.title,
    v_sl.service_date,
    case when v_sl.share_notes then v_sl.memo else null end,
    v_items,
    v_scores;
end;
$$;

revoke all on function public.get_shared_setlist(text) from public, anon, authenticated;
grant execute on function public.get_shared_setlist(text) to anon, authenticated;
