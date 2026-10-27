import { Suspense } from "react";
import { TabBar } from "@/components/tab-bar";
import { Toaster } from "@/components/ui/sonner";

/**
 * 앱 레이아웃 — 모바일/태블릿: 하단 탭바 + 단일 컬럼, 데스크톱(lg~): 좌측 사이드바(w-60) + 본문.
 * 하단 탭바용 여백(pb-24)은 데스크톱에서 필요 없다.
 */
export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col lg:has-[[data-app-nav]]:pl-60">
      <main className="safe-top mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-4 md:px-8 md:pt-6 lg:px-10 lg:pb-10 lg:pt-8">{children}</main>
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
      <Toaster position="top-center" />
    </div>
  );
}
