"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreView } from "@/components/score-view";
import { TransposeBar } from "@/components/transpose-bar";
import { useScoreParam } from "@/hooks/use-score-param";
import { scoreToMusicXML } from "@/lib/music/musicxml";

/**
 * 공연 모드 (태블릿 보면대)
 * - 큰 악보, 화면 좌/우 탭 또는 블루투스 페이지 넘김 페달(←/→, PageUp/PageDown, Space)로 스크롤
 * - 즉석 전조
 */
export default function PerformPage() {
  const { score, update } = useScoreParam();
  const [zoom, setZoom] = useState(1.4);
  const scroller = useRef<HTMLDivElement>(null);
  const xml = useMemo(() => (score ? scoreToMusicXML(score, "lead") : ""), [score]);

  useEffect(() => {
    const page = (dir: 1 | -1) => scroller.current?.scrollBy({ top: dir * window.innerHeight * 0.8, behavior: "smooth" });
    const onKey = (e: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); page(1); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); page(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  if (!score) return <p className="text-ink-soft">{score === undefined ? "불러오는 중…" : "악보를 찾을 수 없어요."}</p>;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-paper">
      <div className="safe-top flex items-center gap-3 border-b border-line px-4 py-2">
        <Link href={`/score/?id=${score.id}`} className="rounded-full border border-line px-3 py-1.5 text-sm">닫기</Link>
        <p className="flex-1 truncate font-semibold">{score.title}</p>
        <button type="button" onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))} className="h-9 w-9 rounded-full border border-line" aria-label="작게">A−</button>
        <button type="button" onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))} className="h-9 w-9 rounded-full border border-line" aria-label="크게">A+</button>
      </div>
      <div
        ref={scroller}
        className="relative flex-1 overflow-y-auto p-3"
        onClick={(e) => {
          const right = e.clientX > window.innerWidth / 2;
          scroller.current?.scrollBy({ top: (right ? 1 : -1) * window.innerHeight * 0.8, behavior: "smooth" });
        }}
      >
        <ScoreView xml={xml} zoom={zoom} />
      </div>
      <div className="safe-bottom border-t border-line px-4 pt-2">
        <div className="mx-auto max-w-md">
          <TransposeBar large originalKey={score.key} transpose={score.transpose} onChange={(t) => update({ transpose: t })} />
        </div>
      </div>
    </div>
  );
}
