"use client";

import { useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { LoadingSpinner } from "@/components/loading-spinner";

const DEBOUNCE_MS = 200;

/**
 * MusicXML 렌더러 (OpenSheetMusicDisplay, BSD-3)
 * 모든 악보 유형은 MusicXML로 만들어 이 컴포넌트 하나로 그립니다.
 * - xml 변경: load + render / zoom만 변경: zoom 설정 + render (load 생략). 둘 다 200ms 디바운스.
 */
export function ScoreView({ xml, zoom = 1, className = "" }: { xml: string; zoom?: number; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const osmdRef = useRef<OpenSheetMusicDisplay | null>(null);
  const loadedXml = useRef<string | null>(null);
  const generation = useRef(0);
  const [error, setError] = useState<string | null>(null);
  const [doneKey, setDoneKey] = useState<{ xml: string; zoom: number } | null>(null);
  const rendering = doneKey?.xml !== xml || doneKey?.zoom !== zoom;

  useEffect(() => {
    let cancelled = false;
    const gen = ++generation.current;
    const isLatest = () => !cancelled && gen === generation.current;
    const timer = setTimeout(() => {
      void (async () => {
        if (!ref.current) return;
        try {
          if (!osmdRef.current) {
            const { OpenSheetMusicDisplay } = await import("opensheetmusicdisplay"); // 브라우저에서만 로드
            if (!isLatest() || !ref.current) return;
            osmdRef.current = new OpenSheetMusicDisplay(ref.current, {
              autoResize: true,
              backend: "svg",
              drawTitle: false,
              drawComposer: false,
              drawPartNames: false,
              drawingParameters: "compacttight",
            });
          }
          const osmd = osmdRef.current;
          if (loadedXml.current !== xml) {
            loadedXml.current = null; // load 도중 상태 불명 → 완료 전까지 null
            await osmd.load(xml);
            loadedXml.current = xml; // 취소돼도 OSMD 내부에는 이 xml이 load됨
            if (!isLatest()) return;
          }
          osmd.zoom = zoom;
          osmd.render();
          setError(null);
        } catch (e) {
          loadedXml.current = null;
          if (isLatest()) setError(e instanceof Error ? e.message : "악보를 그리지 못했습니다");
        } finally {
          if (isLatest()) setDoneKey({ xml, zoom });
        }
      })();
    }, DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [xml, zoom]);

  // 언마운트 시 OSMD 정리
  useEffect(
    () => () => {
      generation.current++;
      try {
        // OSMD는 resize 리스너를 해제하지 않고 AutoResizeEnabled 플래그만 확인하므로 끈다
        if (osmdRef.current) osmdRef.current.AutoResizeEnabled = false;
        osmdRef.current?.clear();
      } catch {
        /* 정리 중 오류는 무시 */
      }
      osmdRef.current = null;
      loadedXml.current = null;
    },
    [],
  );

  return (
    <div className={`score-sheet relative overflow-x-auto rounded-2xl border border-line p-2 shadow-sm ${className}`}>
      {rendering && (
        <div className="no-print flex items-center justify-center gap-2 p-4 text-sm text-ink-soft" aria-live="polite">
          <LoadingSpinner size="sm" />
          <span>악보 그리는 중…</span>
        </div>
      )}
      <div ref={ref} />
      {error && <p className="p-4 text-sm text-tune-bad">{error}</p>}
    </div>
  );
}
