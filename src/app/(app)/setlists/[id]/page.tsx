import { Suspense } from "react";
import { connection } from "next/server";
import Link from "next/link";
import { getSetlist, getSetlistScorePreviews } from "@/app/actions/setlists";
import { LoadingSpinner } from "@/components/loading-spinner";
import { SetlistDetail } from "@/components/setlists/setlist-detail";

export default function SetlistPage({ params }: PageProps<"/setlists/[id]">) {
  return (
    <Suspense fallback={<div className="flex min-h-48 items-center justify-center"><LoadingSpinner /></div>}>
      <SetlistContent params={params} />
    </Suspense>
  );
}

async function SetlistContent({ params }: { params: PageProps<"/setlists/[id]">["params"] }) {
  await connection();
  const { id } = await params;
  const result = await getSetlist(id);
  if (!result.ok) {
    return (
      <div role="alert" className="grid gap-3">
        <h1 className="text-2xl font-semibold">콘티를 불러오지 못했어요</h1>
        <p className="text-sm text-ink-soft">{result.error === "unauthenticated" ? "로그인 후 볼 수 있어요." : "삭제되었거나 접근할 수 없는 콘티예요."}</p>
        <Link href="/setlists" className="h-11 self-start text-sm text-accent underline underline-offset-4">콘티 목록으로</Link>
      </div>
    );
  }
  const scoreResult = await getSetlistScorePreviews(result.data.items.map((item) => item.scoreId));
  return <SetlistDetail setlist={result.data} scoreResult={scoreResult} />;
}
