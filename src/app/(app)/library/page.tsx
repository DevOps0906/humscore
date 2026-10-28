"use client";
import { Suspense } from "react";

import Link from "next/link";
import { AppLogo } from "@/components/app-logo";
import { AuthStatus } from "@/components/auth-status";
import { StartCard } from "@/components/start-card";
import { LibraryList } from "@/components/library/library-view";

function LibraryPageInner() {
  return (
    <div className="flex min-w-0 flex-col gap-5">
      <AppLogo className="self-start lg:hidden" />
      <header className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-3xl font-medium tracking-tight sm:text-4xl">내 악보</h1>
          <p className="text-sm text-ink-soft">허밍 → 악보 → 전조 → 내보내기</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <AuthStatus />
          <Link href="/welcome" className="inline-flex min-h-11 shrink-0 items-center rounded-lg px-1 text-xs text-ink-soft underline underline-offset-4 outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/60">
            앱 소개
          </Link>
        </div>
      </header>

      <StartCard />

      <LibraryList />
    </div>
  );
}

export default function LibraryPage() {
  return (
    <Suspense fallback={null}>
      <LibraryPageInner />
    </Suspense>
  );
}
