/** 없음·만료·회수·삭제·잘못된 토큰 모두 같은 화면 (존재 여부 추측 방지) */
export function InvalidLink() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-3 px-4 py-16 text-center md:px-8">
      <h1 className="text-lg font-semibold md:text-xl">열 수 없는 링크예요</h1>
      <p className="text-sm text-ink-soft">링크가 꺼졌거나 만료됐거나 주소가 잘못됐어요. 보낸 사람에게 새 링크를 요청해 보세요.</p>
    </main>
  );
}
