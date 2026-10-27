# NOW — 재진입 스냅샷 (30줄 이내, 매 작업 끝에 덮어쓴다)

- 갱신: 2026-10-28
- 현재 작업: task-001 앱(Capacitor)에서 PDF 내보내기 — 상태: 대기
- 마지막으로 한 일: task-000 NOMAD 적용 커밋(로컬만, 푸시 안 함 — origin/main보다 11커밋 앞섬)
- 다음 한 걸음: `src/app/(app)/scores/[id]/score-client.tsx:294`의 `window.print()`가 Capacitor WebView(Android·iOS)에서 동작하는지 확인 → 안 되면 `src/lib/platform/`의 웹/앱 분기로 대체 경로(공유 시트 등) 설계
- 열린 결정(사용자 확인 필요): 앱 PDF 대체 방식(공유 시트 vs 서버 생성 vs 인쇄 플러그인 — 새 의존성이면 라이선스 확인)
- 주의: 팀원 쓰기 영역은 `CLAUDE.md` ①표 + `npm run agents:check -- <팀원>`으로 확인. 패키지 관리자는 npm. 푸시는 사용자 지시가 있을 때만.
