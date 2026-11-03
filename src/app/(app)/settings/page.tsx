"use client";
import { Suspense } from "react";

import { AppLogo } from "@/components/app-logo";
import { AccountSection } from "@/components/settings/account-section";
import { DefaultsSection } from "@/components/settings/defaults-section";
import { HelpSection } from "@/components/settings/help-section";
import { MicCheckSection } from "@/components/settings/mic-check-section";
import { ShareLinksSection } from "@/components/settings/share-links-section";

function SettingsPageInner() {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <AppLogo className="self-start lg:hidden" />
      <header>
        <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">설정</h1>
        <p className="text-sm text-ink-soft">계정·마이크·기본값·공유 링크</p>
      </header>
      <div className="grid min-w-0 gap-4 xl:grid-cols-2">
        <AccountSection />
        <MicCheckSection />
        <DefaultsSection />
        <ShareLinksSection />
        <HelpSection />
      </div>
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
