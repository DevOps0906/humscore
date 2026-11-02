import { Suspense } from "react";
import { ShareClient } from "./share-client";

export default function ShareRoute({ params }: PageProps<"/scores/[id]/share">) {
  return (
    <Suspense fallback={null}>
      <ShareContent params={params} />
    </Suspense>
  );
}

async function ShareContent({ params }: { params: PageProps<"/scores/[id]/share">["params"] }) {
  const { id } = await params;
  return <ShareClient id={id} />;
}
