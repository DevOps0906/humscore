"use client";

import { useId, type ReactNode } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScoreView } from "@/components/score-view";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import type { Score } from "@/lib/music/types";

export function ScoreArrangementTabs({ score, view, onViewChange, children }: {
  score: Score;
  view: "full" | "individual";
  onViewChange: (view: "full" | "individual") => void;
  children: ReactNode;
}) {
  const id = useId();
  if (!score.parts?.length) return children;
  return <Tabs value={view} onValueChange={(value) => onViewChange(value === "full" ? "full" : "individual")}>
    <TabsList aria-label="악보 보기" id={id}>
      <TabsTrigger value="full">전체 악보</TabsTrigger>
      <TabsTrigger value="individual">개별 악보</TabsTrigger>
    </TabsList>
    <TabsContent value="full"><ScoreView showHeader xml={scoreToMusicXML(score, "piano")} /></TabsContent>
    <TabsContent value="individual">{children}</TabsContent>
  </Tabs>;
}
