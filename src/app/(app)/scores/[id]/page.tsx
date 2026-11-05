import { Suspense } from "react";
import { ScoreClient } from "./score-client";

export default function ScoreRoute({ params, searchParams }: PageProps<"/scores/[id]">) {
  return (
    <Suspense fallback={null}>
      <ScoreContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function ScoreContent({ params, searchParams }: Pick<PageProps<"/scores/[id]">, "params" | "searchParams">) {
  const [{ id }, query] = await Promise.all([params, searchParams]);
  return <ScoreClient id={id} entry={{ edit: query.edit === "1", compose: query.compose === "1", importAudio: query.import === "audio" }} />;
}
