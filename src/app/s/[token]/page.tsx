import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { fetchSharedScore } from "@/lib/storage/shared-score";
import { fetchSharedSetlist } from "@/lib/storage/shared-setlist";
import { SharedClient } from "./shared-client";
import { SharedSetlistClient } from "@/components/setlists/shared-setlist-client";
import { InvalidLink } from "./invalid-link";

// 헤더(X-Robots-Tag·Cache-Control·Referrer-Policy)는 src/proxy.ts. 여기는 meta 보조.
export const metadata: Metadata = {
  title: "공유된 악보·콘티 — HumScore",
  robots: { index: false, follow: false },
  referrer: "no-referrer",
};

export default function SharedRoute({ params }: PageProps<"/s/[token]">) {
  return (
    <Suspense
      fallback={
        <main className="flex flex-1 items-center justify-center p-6" aria-busy="true">
          <LoadingSpinner />
        </main>
      }
    >
      <SharedContent params={params} />
    </Suspense>
  );
}

async function SharedContent({ params }: { params: PageProps<"/s/[token]">["params"] }) {
  await connection(); // 동적 렌더 — 정적 최적화·캐시 금지
  const { token } = await params;
  const score = await fetchSharedScore(token);
  if (score) return <SharedClient score={score} />;
  const setlist = await fetchSharedSetlist(token);
  if (!setlist) return <InvalidLink />;
  return <SharedSetlistClient setlist={setlist} />;
}
