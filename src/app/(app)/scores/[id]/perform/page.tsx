import { Suspense } from "react";
import { PerformClient } from "./perform-client";

export default function PerformRoute({ params }: PageProps<"/scores/[id]/perform">) {
  return (
    <Suspense fallback={null}>
      <PerformContent params={params} />
    </Suspense>
  );
}

async function PerformContent({ params }: { params: PageProps<"/scores/[id]/perform">["params"] }) {
  const { id } = await params;
  return <PerformClient id={id} />;
}
