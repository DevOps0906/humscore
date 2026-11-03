import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getSetlist, listSetlistScoreOptions } from "@/app/actions/setlists";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SetlistEditor } from "@/components/setlists/setlist-editor";

export default function EditSetlistPage({ params }: PageProps<"/setlists/[id]/edit">) {
  return (
    <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><LoadingSpinner /></div>}>
      <EditSetlistContent params={params} />
    </Suspense>
  );
}

async function EditSetlistContent({ params }: { params: PageProps<"/setlists/[id]/edit">["params"] }) {
  await connection();
  const { id } = await params;
  const setlistResult = await getSetlist(id);
  if (!setlistResult.ok) {
    return (
      <div role="alert" className="grid gap-3">
        <h1 className="text-2xl font-semibold">콘티를 불러오지 못했어요</h1>
        <p className="text-sm text-ink-soft">{setlistResult.error === "unauthenticated" ? "로그인 후 편집할 수 있어요." : "삭제되었거나 접근할 수 없는 콘티예요."}</p>
        <Link href="/setlists" className="h-11 self-start text-sm text-accent underline underline-offset-4">콘티 목록으로</Link>
      </div>
    );
  }
  const scoreResult = await listSetlistScoreOptions();
  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">콘티 편집</h1>
        <p className="mt-1 text-sm text-ink-soft">변경한 뒤 저장 버튼을 눌러 주세요.</p>
      </header>
      <SetlistEditor setlist={setlistResult.data} scoreResult={scoreResult} />
    </div>
  );
}
