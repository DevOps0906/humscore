import { Suspense } from "react";
import { TabBar } from "@/components/tab-bar";
import { Toaster } from "@/components/ui/sonner";

export default function AppLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <main className="safe-top mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8">{children}</main>
      <Suspense fallback={null}>
        <TabBar />
      </Suspense>
      <Toaster position="top-center" />
    </>
  );
}
