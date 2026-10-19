import { Suspense } from "react";
import { ScoreClient } from "./score-client";

export default function ScoreRoute({ params }: PageProps<"/scores/[id]">) {
  return (
    <Suspense fallback={null}>
      <ScoreContent params={params} />
    </Suspense>
  );
}

async function ScoreContent({ params }: { params: PageProps<"/scores/[id]">["params"] }) {
  const { id } = await params;
  return <ScoreClient id={id} />;
}
