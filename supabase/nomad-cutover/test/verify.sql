-- check.sh 전용: 02 apply 뒤 값·트리거 우회·RLS 격리·공유 RPC 확인(읽기만, 끝에 rollback).
begin;

do $$
begin
  if (select count(*) from nomad_humscore.scores) <> 5 or (select count(*) from nomad_humscore.setlists) <> 3
     or (select count(*) from nomad_humscore.share_links) <> 4 or (select count(*) from nomad_humscore.transcription_jobs) <> 2 then
    raise exception 'verify: 행 수가 시드(5·3·4·2)와 다르다';
  end if;
  -- replica 가 실제로 먹었는지: 트리거가 켜졌다면 아래 값은 복사되지 못하거나 바뀐다
  if (select revoked_at from nomad_humscore.share_links where id = 'a3000000-0000-4000-8000-000000000002') is null then
    raise exception 'verify: 회수된 링크의 revoked_at 이 사라졌다';
  end if;
  if (select updated_at from nomad_humscore.setlists where id = 'a2000000-0000-4000-8000-000000000001')
     is distinct from (select updated_at from public.setlists where id = 'a2000000-0000-4000-8000-000000000001') then
    raise exception 'verify: 콘티 updated_at 이 touch 트리거로 바뀌었다';
  end if;
  if not (select items @> '[{"scoreId":"a1000000-0000-4000-8000-000000000003"}]' from nomad_humscore.setlists
          where id = 'a2000000-0000-4000-8000-000000000001') then
    raise exception 'verify: 삭제된 악보를 가리키는 콘티 항목이 사라졌다';
  end if;
  if (select deleted_at from nomad_humscore.scores where id = 'a1000000-0000-4000-8000-000000000003') is null then
    raise exception 'verify: 소프트 삭제 표시가 사라졌다';
  end if;
end $$;

-- RLS 격리: 사용자 A
set local role authenticated;
set local request.jwt.claims = '{"sub":"aaaaaaaa-0000-4000-8000-000000000001","role":"authenticated"}';
do $$
begin
  if (select count(*) from nomad_humscore.scores) <> 3
     or (select count(*) from nomad_humscore.setlists) <> 2
     or (select count(*) from nomad_humscore.share_links) <> 3
     or (select count(*) from nomad_humscore.transcription_jobs) <> 1 then
    raise exception 'verify: A 가 보는 행 수가 3·2·3·1 이 아니다';
  end if;
  if exists (select 1 from nomad_humscore.scores where user_id <> 'aaaaaaaa-0000-4000-8000-000000000001') then
    raise exception 'verify: A 가 다른 사용자 악보를 본다';
  end if;
end $$;

-- 사용자 B
set local request.jwt.claims = '{"sub":"bbbbbbbb-0000-4000-8000-000000000002","role":"authenticated"}';
do $$
begin
  if (select count(*) from nomad_humscore.scores) <> 2
     or exists (select 1 from nomad_humscore.scores where user_id <> 'bbbbbbbb-0000-4000-8000-000000000002')
     or exists (select 1 from nomad_humscore.setlists where user_id <> 'bbbbbbbb-0000-4000-8000-000000000002')
     or (select count(*) from nomad_humscore.share_links) <> 1 then
    raise exception 'verify: B 의 격리가 어긋났다';
  end if;
end $$;

-- 익명: 공유 RPC 는 활성 링크만, 회수된 링크는 0행
reset role;
set local role anon;
set local request.jwt.claims = '{"role":"anon"}';
do $$
begin
  if (select title from nomad_humscore.get_shared_score('cutoverA' || repeat('x', 35))) is distinct from 'A 악보 1' then
    raise exception 'verify: 활성 악보 링크가 열리지 않는다';
  end if;
  if exists (select 1 from nomad_humscore.get_shared_score('cutoverR' || repeat('x', 35))) then
    raise exception 'verify: 회수된 링크가 열린다';
  end if;
  if (select title from nomad_humscore.get_shared_setlist('cutoverL' || repeat('x', 35))) is distinct from 'A 주일 콘티' then
    raise exception 'verify: 콘티 링크가 열리지 않는다';
  end if;
end $$;

rollback;
\echo 'verify: 값·트리거 우회·RLS 격리·공유 RPC 통과'
