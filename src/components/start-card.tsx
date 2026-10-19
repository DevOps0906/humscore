"use client";

import { useState } from "react";
import Link from "next/link";
import { Mic, Piano } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

type Mode = "record" | "keys";

const PANELS: { id: Mode; tab: string; title: string; sub: string; cta: string; href: string }[] = [
  { id: "record", tab: "녹음", title: "떠오른 멜로디를 흥얼거려 보세요", sub: "30초면 코드 악보가 만들어져요", cta: "녹음 시작", href: "/record" },
  { id: "keys", tab: "건반 입력", title: "88건반을 눌러 음표를 적어요", sub: "음 길이를 고르고 건반을 누르면 바로 악보가 그려져요", cta: "건반으로 입력", href: "/keys?entry=1" },
];

export function StartCard() {
  const [mode, setMode] = useState<Mode>("record");

  return (
    <Card className="gap-4 p-4 shadow-md" aria-label="새 악보 만들기">
      <div role="tablist" aria-label="입력 방식" className="flex gap-2">
        {PANELS.map((p) => {
          const on = mode === p.id;
          const Icon = p.id === "record" ? Mic : Piano;
          return (
            <Button
              key={p.id}
              type="button"
              role="tab"
              id={`start-tab-${p.id}`}
              aria-selected={on}
              aria-controls={`start-panel-${p.id}`}
              variant="outline"
              onClick={() => setMode(p.id)}
              className={`h-11 flex-1 gap-2 text-sm ${on ? "border-accent text-accent" : "text-ink-soft"}`}
            >
              <Icon aria-hidden />
              {p.tab}
            </Button>
          );
        })}
      </div>

      {/* 두 패널을 같은 grid 칸에 겹쳐 항상 큰 쪽 크기로 고정 */}
      <CardContent className="grid p-0">
        {PANELS.map((p) => {
          const on = mode === p.id;
          const Icon = p.id === "record" ? Mic : Piano;
          return (
            <div
              key={p.id}
              role="tabpanel"
              id={`start-panel-${p.id}`}
              aria-labelledby={`start-tab-${p.id}`}
              aria-hidden={!on}
              className={`flex min-w-0 flex-col gap-4 [grid-area:1/1] ${on ? "" : "pointer-events-none invisible"}`}
            >
              <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line px-5 py-8 text-center">
                <span className="text-accent"><Icon className="size-9" strokeWidth={1.8} aria-hidden /></span>
                <strong className="font-medium">{p.title}</strong>
                <small className="text-xs text-ink-soft">{p.sub}</small>
              </div>
              <Button asChild variant="outline" className="h-11 w-full border-accent text-accent hover:bg-accent/10 hover:text-accent">
                <Link href={p.href} tabIndex={on ? 0 : -1}>{p.cta}</Link>
              </Button>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
