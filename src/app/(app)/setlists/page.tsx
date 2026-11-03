import { Suspense } from "react";
import { connection } from "next/server";
import { AppLogo } from "@/components/app-logo";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SetlistsList } from "@/components/setlists/setlists-list";
import { listSetlists } from "@/app/actions/setlists";

export default function SetlistsPage() {
  return (
    <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><LoadingSpinner /></div>}>
      <SetlistsContent />
    </Suspense>
  );
}

async function SetlistsContent() {
  await connection();
  const result = await listSetlists();
  return (
    <div className="flex flex-col gap-5">
      <AppLogo className="self-start lg:hidden" />
      <header>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">찬양 콘티</h1>
        <p className="mt-1 text-sm text-ink-soft">내 악보로 예배 순서를 정리하고 팀에 공유해요.</p>
      </header>
      <SetlistsList result={result} />
    </div>
  );
}
