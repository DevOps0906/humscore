"use client";
import { Suspense, useEffect, useState } from "react";

import { AppLogo } from "@/components/app-logo";
import { AccountSection } from "@/components/settings/account-section";
import { DefaultsSection } from "@/components/settings/defaults-section";
import { HelpSection } from "@/components/settings/help-section";
import { LlmApiSection } from "@/components/settings/llm-api-section";
import { MicCheckSection } from "@/components/settings/mic-check-section";
import { ShareLinksSection } from "@/components/settings/share-links-section";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

const TABS = [
  { id: "account", label: "계정" },
  { id: "mic", label: "마이크" },
  { id: "defaults", label: "기본값" },
  { id: "share", label: "공유 링크" },
  { id: "llm", label: "LLM API" },
  { id: "help", label: "도움말" },
] as const;
type TabId = (typeof TABS)[number]["id"];
const isTabId = (value: string): value is TabId => TABS.some((tab) => tab.id === value);

function SettingsPageInner() {
  const [tab, setTab] = useState<TabId>("account");

  // 주소 해시(#llm)로 바로 열고, 탭을 바꾸면 해시를 갱신해 새로고침해도 같은 탭을 연다
  useEffect(() => {
    const t = setTimeout(() => {
      const hash = window.location.hash.slice(1);
      if (isTabId(hash)) setTab(hash);
    }, 0);
    return () => clearTimeout(t);
  }, []);

  // 좁은 화면에서 고른 탭이 가려지지 않게 가운데로 스크롤한다
  useEffect(() => {
    document.querySelector<HTMLElement>('[role="tablist"] [role="tab"][aria-selected="true"]')?.scrollIntoView({ inline: "center", block: "nearest" });
  }, [tab]);

  return (
    <div className="flex min-w-0 flex-col gap-5">
      <AppLogo className="self-start lg:hidden" />
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">설정</h1>
        <p className="text-sm text-ink-soft">계정·마이크·기본값·공유 링크·LLM API</p>
      </header>
      <Tabs
        value={tab}
        onValueChange={(value) => {
          if (!isTabId(value)) return;
          setTab(value);
          window.history.replaceState(null, "", `#${value}`);
        }}
        className="min-w-0 gap-4"
      >
        <div className="-mx-1 overflow-x-auto px-1">
          <TabsList aria-label="설정 항목" variant="line" className="h-auto min-w-max gap-1 p-0">
            {TABS.map(({ id, label }) => (
              <TabsTrigger key={id} value={id} className="h-11 flex-none rounded-full px-4 text-sm lg:h-9">{label}</TabsTrigger>
            ))}
          </TabsList>
        </div>
        <TabsContent value="account" className="min-w-0"><AccountSection /></TabsContent>
        <TabsContent value="mic" className="min-w-0"><MicCheckSection /></TabsContent>
        <TabsContent value="defaults" className="min-w-0"><DefaultsSection /></TabsContent>
        <TabsContent value="share" className="min-w-0"><ShareLinksSection /></TabsContent>
        <TabsContent value="llm" className="min-w-0"><LlmApiSection /></TabsContent>
        <TabsContent value="help" className="min-w-0"><HelpSection /></TabsContent>
      </Tabs>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={null}>
      <SettingsPageInner />
    </Suspense>
  );
}
