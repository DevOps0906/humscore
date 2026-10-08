"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";

/**
 * MusicXML 렌더러 (OpenSheetMusicDisplay, BSD-3)
 * 모든 악보 유형은 MusicXML로 만들어 이 컴포넌트 하나로 그립니다.
 */
export function ScoreView({ xml, zoom = 1, className = "" }: { xml: string; zoom?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (!ref.current) return;
      try {
        if (!osmdRef.current) {
          const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay"); // 브라우저에서만 로드
          if (cancelled || !ref.current) return;
          osmdRef.current = new OpenSheetMusicDisplay(ref.current, {
            autoResize: true,
            backend: "svg",
            drawTitle: false,
            drawComposer: false,
            drawPartNames: false,
            drawingParameters: "compacttight",
          });
        }
        await osmdRef.current.load(xml);
        if (cancelled) return;
        osmdRef.current.zoom = zoom;
        osmdRef.current.render();
        setError(null);
      } catch (e) {
        setError(e instanceof Error ? e.message : "악보를 그리지 못했습니다");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [xml, zoom]);

  return (
    <div className={`score-sheet overflow-x-auto rounded-2xl border border-line p-2 shadow-sm ${className}`}>
      <div ref={ref} />
      {error && <p className="p-4 text-sm text-tune-bad">{error}</p>}
    </div>
  );
}
