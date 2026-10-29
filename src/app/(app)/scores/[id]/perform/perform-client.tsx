"use client";
import Link from "next/link";
import { Music2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useEffect, useMemo, useRef, useState } from "react";
import { ScoreHeader } from "@/components/score-header";
import { FollowPanel } from "@/components/follow-panel";
import { ScoreView, type ScoreCursorProps } from "@/components/score-view";
import { TransposeBar } from "@/components/transpose-bar";
import { useFollowAlong } from "@/hooks/use-follow-along";
import { useScore } from "@/hooks/use-score-param";
import { scoreToMusicXML } from "@/lib/music/musicxml";

/**
 * 공연 모드 (태블릿 보면대)
 * - 큰 악보, 화면 좌/우 탭 또는 블루투스 페이지 넘김 페달(←/→, PageUp/PageDown, Space)로 스크롤
 * - 즉석 전조
 */
export function PerformClient({ id }: { id: string }) {
  const { score, update } = useScore(id);
  const [zoom, setZoom] = useState(1.4);
  const [following, setFollowing] = useState(false);
  const follow = useFollowAlong(score);
  const { end: endFollow } = follow;
  const scroller = useRef<HTMLDivElement>(null);
  const xml = useMemo(() => (score ? scoreToMusicXML(score, "lead", { externalHeader: true }) : ""), [score]);

  useEffect(() => {
    const page = (dir: 1 | -1) => scroller.current?.scrollBy({ top: dir * window.innerHeight * 0.8, behavior: "smooth" });
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement | null)?.closest?.("button, input, textarea, select, a, [role=button]")) return;
      if (["ArrowRight", "ArrowDown", "PageDown", " "].includes(e.key)) { e.preventDefault(); page(1); }
      if (["ArrowLeft", "ArrowUp", "PageUp"].includes(e.key)) { e.preventDefault(); page(-1); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const toggleFollow = () => {
    if (following) endFollow();
    setFollowing(!following);
  };

  // 다음에 칠 음을 악보에 강조 (편집 커서 재사용, 선택·편집은 막음)
  const cursor: ScoreCursorProps | undefined =
    following && score && follow.currentNoteIndex !== null
      ? {
          notes: score.notes,
          beatsPerMeasure: score.beatsPerMeasure,
          selected: follow.currentNoteIndex,
          onSelect: () => {},
          announce: "",
          toolbarOpen: false,
          onDismiss: () => {},
          dragLabel: () => null,
          onDragPreview: () => {},
          onDragCommit: () => {},
        }
      : undefined;

  if (!score) return <p className="text-ink-soft">{score === undefined ? "불러오는 중…" : "악보를 찾을 수 없어요."}</p>;

  return (
    <div className="fixed inset-0 z-30 flex flex-col bg-paper lg:grid lg:grid-cols-[minmax(0,1fr)_auto] lg:grid-rows-[auto_minmax(0,1fr)_auto]">
      <div className="safe-top flex items-center gap-3 border-b border-line px-4 py-2 lg:col-span-2 lg:row-start-1">
        <Button asChild variant="outline" className="h-11 rounded-full px-4 text-sm">
          <Link href={`/scores/${score.id}`} aria-label="닫기"><X aria-hidden /><span className="max-md:hidden">닫기</span></Link>
        </Button>
        <p className="flex-1 truncate font-medium">{score.title}</p>
        <Button type="button" variant={following ? "default" : "outline"} onClick={toggleFollow} aria-pressed={following} className="h-11 rounded-full px-4 text-sm max-md:size-11 max-md:px-0" aria-label="따라 치기">
          <Music2 aria-hidden /><span className="max-md:hidden">따라 치기</span>
        </Button>
        <Button type="button" variant="outline" onClick={() => setZoom((z) => Math.max(0.8, z - 0.2))} className="size-11 rounded-full" aria-label="작게">A−</Button>
        <Button type="button" variant="outline" onClick={() => setZoom((z) => Math.min(2.6, z + 0.2))} className="size-11 rounded-full" aria-label="크게">A+</Button>
      </div>
      <div
        ref={scroller}
        className="relative flex-1 overflow-y-auto p-3 lg:col-start-1 lg:row-start-2 lg:min-h-0 lg:border-b lg:border-line"
        onClick={(e) => {
          const r = e.currentTarget.getBoundingClientRect(); // 데스크톱 우측 패널이 있으면 창 중앙 ≠ 악보 중앙
          const right = e.clientX > r.left + r.width / 2;
          scroller.current?.scrollBy({ top: (right ? 1 : -1) * window.innerHeight * 0.8, behavior: "smooth" });
        }}
      >
        <ScoreView showHeader={false} header={<ScoreHeader score={score} />} xml={xml} zoom={zoom} cursor={cursor} />
      </div>
      {/* 모바일·태블릿: 하단 패널(따라 치기 + 전조) / 데스크톱 1200~: 따라 치기는 악보 우측 패널, 전조는 악보 아래 */}
      <div className="safe-bottom border-t border-line px-4 pt-2 lg:contents">
        {following && (
          <aside
            aria-label="따라 치기"
            className="lg:col-start-2 lg:row-span-2 lg:row-start-2 lg:w-96 lg:overflow-y-auto lg:border-l lg:border-line lg:px-5 lg:py-4"
          >
            <FollowPanel follow={follow} />
          </aside>
        )}
        <div
          className={`mx-auto max-w-md lg:col-start-1 lg:row-start-3 lg:w-full lg:px-4 lg:pt-2 lg:pb-2 ${following ? "[@media(max-height:480px)]:hidden" : ""}`}
        >
          <TransposeBar large originalKey={score.key} transpose={score.transpose} onChange={(t) => update({ transpose: t })} />
        </div>
      </div>
    </div>
  );
}

