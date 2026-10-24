-- HumScore: 악보 저장 테이블 (MVP)
-- 앱은 브라우저 클라이언트로 직접 접근하므로 RLS가 유일한 보안 경계입니다.

create table if not exists public.scores (
  id          uuid primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  title       text not null,
  data        jsonb not null,           -- Score 객체 전체 (notes, chords, key, transpose ...)
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists scores_user_updated_idx on public.scores (user_id, updated_at desc);

alter table public.scores enable row level security;

create policy "scores: owner can read"   on public.scores for select using ((select auth.uid()) = user_id);
create policy "scores: owner can insert" on public.scores for insert with check ((select auth.uid()) = user_id);
create policy "scores: owner can update" on public.scores for update using ((select auth.uid()) = user_id) with check ((select auth.uid()) = user_id);
create policy "scores: owner can delete" on public.scores for delete using ((select auth.uid()) = user_id);

-- 3단계(GPU 워커)용 작업 큐 자리. Next.js → jobs insert → Python 워커가 가져가 처리 → result 기록
create table if not exists public.transcription_jobs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  kind        text not null check (kind in ('separate', 'transcribe_multi', 'arrange')),
  status      text not null default 'queued' check (status in ('queued', 'running', 'done', 'failed')),
  input_path  text,                     -- Supabase Storage 경로
  result      jsonb,
  error       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.transcription_jobs enable row level security;

create policy "jobs: owner can read"   on public.transcription_jobs for select using ((select auth.uid()) = user_id);
create policy "jobs: owner can create" on public.transcription_jobs for insert with check ((select auth.uid()) = user_id and status = 'queued');
-- 상태 변경은 워커(service role)만 수행 → update 정책 없음
