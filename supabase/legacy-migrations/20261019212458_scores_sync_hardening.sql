-- HumScore: 동기화 강화
--  1) 소프트 삭제(deleted_at) — 다른 기기에서 지운 악보가 되살아나지 않게 합니다.
--  2) 서버측 last-write-wins 가드 — 오래된 쓰기는 조용히 무시.
--  3) 미래 시각 updated_at 보정(최대 5분), 사용자당 살아있는 악보 2000개 제한.

alter table public.scores add column if not exists deleted_at timestamptz;

create index if not exists scores_user_deleted_idx on public.scores (user_id, deleted_at);

-- (a) 미래 시각 보정: 트리거는 이름 순으로 실행되므로 'a_' 가 LWW 가드('b_')보다 먼저 돈다.
create or replace function public.scores_clamp_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at > now() + interval '5 minutes' then
    new.updated_at := now();
  end if;
  if new.deleted_at is not null and new.deleted_at > now() + interval '5 minutes' then
    new.deleted_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists scores_a_clamp on public.scores;
create trigger scores_a_clamp
  before insert or update on public.scores
  for each row execute function public.scores_clamp_updated_at();

-- (b) last-write-wins: 더 최신이 아니면 UPDATE 를 건너뜀 (upsert 도 오류 없이 무시됨)
create or replace function public.scores_lww_guard() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.updated_at <= old.updated_at then
    return null;
  end if;
  return new;
end;
$$;

drop trigger if exists scores_b_lww on public.scores;
create trigger scores_b_lww
  before update on public.scores
  for each row execute function public.scores_lww_guard();

-- (c) 사용자당 살아있는 악보 2000개 제한 (새 행 INSERT 시에만 검사)
create or replace function public.scores_row_cap() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.deleted_at is null
     and not exists (select 1 from public.scores where id = new.id)
     and (select count(*) from public.scores where user_id = new.user_id and deleted_at is null) >= 2000 then
    raise exception 'score limit reached (2000)' using errcode = '53400';
  end if;
  return new;
end;
$$;

drop trigger if exists scores_c_row_cap on public.scores;
create trigger scores_c_row_cap
  before insert on public.scores
  for each row execute function public.scores_row_cap();

-- 삭제는 앱에서 deleted_at 으로 처리(UPDATE). 하드 DELETE 정책은 계정 정리용으로 그대로 둠.
