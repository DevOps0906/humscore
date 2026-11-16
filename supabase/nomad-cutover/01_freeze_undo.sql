-- humscore 이관 1단계 되돌리기: 01_freeze.sql 이 적어 둔 권한을 그대로 다시 주고 기록 스키마를 지운다.
-- 실행: psql "<DB 주소>" -v ON_ERROR_STOP=1 -f supabase/nomad-cutover/01_freeze_undo.sql
-- 쓰기 재개(새 앱 배포) 뒤에는 실행하지 않는다 — 옛 표에 다시 쓰이기 시작하면 새 표와 갈라진다.
begin;

do $$
declare
  g record;
begin
  if to_regnamespace('nomad_cutover_humscore') is null then
    raise exception '동결 기록(nomad_cutover_humscore)이 없다 — 01_freeze.sql 이 실행되지 않았거나 이미 되돌림';
  end if;
  for g in select * from nomad_cutover_humscore.frozen_grants loop
    execute format('grant %s%s on public.%I to %I%s',
      g.privilege,
      case when g.column_name is null then '' else format(' (%I)', g.column_name) end,
      g.table_name, g.grantee,
      case when g.grantable then ' with grant option' else '' end);
  end loop;
end $$;

drop schema nomad_cutover_humscore cascade;

commit;
