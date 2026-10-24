-- HumScore 로컬 개발용 시드 (npm run db:reset 때 적용)
-- 테스트 계정: dev@humscore.local / password123 (이메일 인증 완료)

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  recovery_sent_at, last_sign_in_at, raw_app_meta_data, raw_user_meta_data,
  created_at, updated_at, confirmation_token, email_change, email_change_token_new,
  email_change_token_current, recovery_token, phone_change, phone_change_token, reauthentication_token
) values (
  '00000000-0000-0000-0000-000000000000', 'a1b2c3d4-0000-4000-8000-000000000001', 'authenticated', 'authenticated',
  'dev@humscore.local', crypt('password123', gen_salt('bf')), now(),
  now(), now(), '{"provider":"email","providers":["email"]}', '{}',
  now(), now(), '', '', '', '', '', '', '', ''
);

insert into auth.identities (
  id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at
) values (
  gen_random_uuid(), 'a1b2c3d4-0000-4000-8000-000000000001',
  format('{"sub":"%s","email":"%s","email_verified":true,"phone_verified":false}', 'a1b2c3d4-0000-4000-8000-000000000001', 'dev@humscore.local')::jsonb,
  'email', 'a1b2c3d4-0000-4000-8000-000000000001', now(), now(), now()
);

insert into public.scores (id, user_id, title, data, created_at, updated_at) values
('5b1d7a10-3c2e-4f6a-9b8d-0a1b2c3d4e01', 'a1b2c3d4-0000-4000-8000-000000000001', '학교종 (예시)', $json${"id":"5b1d7a10-3c2e-4f6a-9b8d-0a1b2c3d4e01","title":"학교종 (예시)","bpm":100,"beatsPerMeasure":4,"beatUnit":4,"key":{"tonic":0,"mode":"major","fifths":0},"transpose":0,"createdAt":"2026-10-20T09:00:00.000Z","updatedAt":"2026-10-20T09:00:00.000Z","composer":"작자 미상","notes":[{"midi":67,"startBeat":0,"durationBeats":1},{"midi":67,"startBeat":1,"durationBeats":1},{"midi":69,"startBeat":2,"durationBeats":1},{"midi":69,"startBeat":3,"durationBeats":1},{"midi":67,"startBeat":4,"durationBeats":1},{"midi":67,"startBeat":5,"durationBeats":1},{"midi":64,"startBeat":6,"durationBeats":2},{"midi":67,"startBeat":8,"durationBeats":1},{"midi":64,"startBeat":9,"durationBeats":1},{"midi":62,"startBeat":10,"durationBeats":1},{"midi":64,"startBeat":11,"durationBeats":1},{"midi":60,"startBeat":12,"durationBeats":4}],"chords":[{"startBeat":0,"symbol":"C"},{"startBeat":4,"symbol":"C"},{"startBeat":8,"symbol":"G"},{"startBeat":12,"symbol":"C"}]}$json$::jsonb, '2026-10-20T09:00:00.000Z', '2026-10-20T09:00:00.000Z'),
('5b1d7a10-3c2e-4f6a-9b8d-0a1b2c3d4e02', 'a1b2c3d4-0000-4000-8000-000000000001', '반짝반짝 작은 별 (셈여림·도돌이표 예시)', $json${"id":"5b1d7a10-3c2e-4f6a-9b8d-0a1b2c3d4e02","title":"반짝반짝 작은 별 (셈여림·도돌이표 예시)","bpm":90,"beatsPerMeasure":4,"beatUnit":4,"key":{"tonic":0,"mode":"major","fifths":0},"transpose":0,"createdAt":"2026-10-20T09:00:00.000Z","updatedAt":"2026-10-20T09:00:00.000Z","composer":"작자 미상","notes":[{"midi":60,"startBeat":0,"durationBeats":1},{"midi":60,"startBeat":1,"durationBeats":1},{"midi":67,"startBeat":2,"durationBeats":1},{"midi":67,"startBeat":3,"durationBeats":1},{"midi":69,"startBeat":4,"durationBeats":1},{"midi":69,"startBeat":5,"durationBeats":1},{"midi":67,"startBeat":6,"durationBeats":2},{"midi":65,"startBeat":8,"durationBeats":1},{"midi":65,"startBeat":9,"durationBeats":1},{"midi":64,"startBeat":10,"durationBeats":1},{"midi":64,"startBeat":11,"durationBeats":1},{"midi":62,"startBeat":12,"durationBeats":1},{"midi":62,"startBeat":13,"durationBeats":1},{"midi":60,"startBeat":14,"durationBeats":2}],"chords":[{"startBeat":0,"symbol":"C"},{"startBeat":4,"symbol":"F"},{"startBeat":6,"symbol":"C"},{"startBeat":8,"symbol":"F"},{"startBeat":10,"symbol":"C"},{"startBeat":12,"symbol":"G"},{"startBeat":14,"symbol":"C"}],"dynamics":[{"startBeat":0,"kind":"p"},{"startBeat":4,"kind":"cresc","durationBeats":4},{"startBeat":8,"kind":"f"},{"startBeat":12,"kind":"dim","durationBeats":4}],"marks":[{"measure":0,"kind":"repeatStart"},{"measure":3,"kind":"repeatEnd"}]}$json$::jsonb, '2026-10-20T09:00:00.000Z', '2026-10-20T09:00:00.000Z');
