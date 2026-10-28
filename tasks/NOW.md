# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-28
- 현재 작업: 없음 (task-003 완료)
- 마지막으로 한 일: task-003 동기화 버그 수정 — saveScore/deleteScore(…, expectedUserId)·"mismatch"/"stale" 오류, dirty 추적(humscore.dirty.v1), 로그아웃 경고, online·화면 복귀 재동기화, 로그아웃 후 부활·계정 전환 오프라인 노출 차단. 테스트 520건
- 다음 한 걸음: task-012(로컬 Supabase 통합 검증: RLS·LWW 트리거 0행 반환·타인 id upsert + 로그인 e2e)로 mock 밖 동작 확인
- 알려진 한계: 세션 만료 후 다른 계정(B)이 저장하면 이전 계정(A)의 못 올린 변경은 이 기기에서 지워짐(클라우드에 올라간 것만 남음). unsyncable 개수는 메모리 기준(새로고침 직후 0, flush 후 재계산)
- 열린 결정: task-002 범위, task-008·task-010 착수 여부
- 주의: 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`. 푸시는 사용자 지시가 있을 때만. `.serena/`는 커밋하지 않음.
