"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { ChevronDown } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { beatKey, hitTestMarks, noteIndexByStart, type MarkRect } from "@/components/score-cursor";
import type { NoteEvent } from "@/lib/music/types";

const DEBOUNCE_MS = 200;

/** 편집 커서 (편집 모드에서만 전달). 없으면 ScoreView 는 순수 뷰어로 동작 */
export interface ScoreCursorProps {
  /** xml 을 만든 Score 의 notes (저장 순서 = 인덱스) */
  notes: NoteEvent[];
  beatsPerMeasure: number;
  selected: number | null;
  onSelect: (index: number) => void;
  /** 스크린리더 안내문 (aria-live) */
  announce: string;
}

interface GNoteLike {
  getSVGGElement?: () => SVGGElement | null;
}

/** OSMD 그래픽 시트의 melody 보표(0번)에서 Score 음표 index → 컨테이너 기준 사각형 */
function computeMarks(osmd: OpenSheetMusicDisplay, sheet: HTMLElement, notes: NoteEvent[]): (MarkRect | undefined)[] {
  const marks: (MarkRect | undefined)[] = [];
  const base = sheet.getBoundingClientRect();
  const bpmUnit = 4; // OSMD 시간 단위=온음표, 박=4분음표 (musicxml.ts 는 항상 beat-type 4)
  const byStart = noteIndexByStart(notes);
  const measures = osmd.GraphicSheet?.MeasureList ?? [];
  for (const staves of measures) {
    const gm = staves?.[0]; // melody 보표(피아노 모드에선 위 보표)
    if (!gm) continue;
    for (const gn of gm.staffEntries.flatMap((se) => se.graphicalVoiceEntries.flatMap((ve) => ve.notes))) {
      const idx = byStart.get(beatKey(gn.sourceNote.getAbsoluteTimestamp().RealValue * bpmUnit));
      if (idx === undefined || marks[idx]) continue;
      const g = (gn as unknown as GNoteLike).getSVGGElement?.();
      if (!g) continue;
      const all = g.getBoundingClientRect();
      const head = (g.querySelector(".vf-notehead") ?? g).getBoundingClientRect();
      if (all.width === 0 && all.height === 0) continue;
      marks[idx] = {
        left: head.left - base.left + sheet.scrollLeft,
        top: all.top - base.top + sheet.scrollTop,
        width: head.width || all.width,
        height: all.height,
      };
    }
  }
  return marks;
}

/**
 * MusicXML 렌더러 (OpenSheetMusicDisplay, BSD-3)
 * 모든 악보 유형은 MusicXML로 만들어 이 컴포넌트 하나로 그립니다.
 * - xml 변경: load + render / zoom만 변경: zoom 설정 + render (load 생략). 둘 다 200ms 디바운스.
 */
export function ScoreView({
  xml,
  zoom = 1,
  className = "",
  cursor,
}: {
  xml: string;
  zoom?: number;
  className?: string;
  cursor?: ScoreCursorProps;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef(cursor);
  cursorRef.current = cursor;
  const [marks, setMarks] = useState<{ xml: string; list: (MarkRect | undefined)[] } | null>(null);
  const hasCursor = !!cursor;

  const updateMarks = useCallback(() => {
    const c = cursorRef.current;
    const osmd = osmdRef.current;
    const loaded = loadedXml.current;
    if (!c || !osmd || !sheetRef.current || loaded === null) return;
    try {
      setMarks({ xml: loaded, list: computeMarks(osmd, sheetRef.current, c.notes) });
    } catch {
      setMarks(null);
    }
  }, []);

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
              newSystemFromXML: true,
              backend: "svg",
              drawTitle: false,
              drawComposer: false,
              drawPartNames: false,
              drawingParameters: "compacttight",
              autoGenerateMultipleRestMeasuresFromRestMeasures: false, // 빈 마디를 "7" 식 다중쉼표로 합치지 않음 (8마디 미리보기)
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
          if (isLatest()) updateMarks();
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
  }, [xml, zoom, updateMarks]);

  // 커서 모드: OSMD 가 자체적으로 다시 그릴 때(창 크기 변경 등)도 위치 재계산
  useEffect(() => {
    const el = ref.current;
    if (!hasCursor || !el) return;
    let raf = 0;
    const mo = new MutationObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateMarks);
    });
    mo.observe(el, { childList: true });
    updateMarks(); // 편집 모드로 막 들어온 경우: 이미 그려진 악보에서 바로 계산
    return () => {
      mo.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [hasCursor, updateMarks]);

  // 로딩 표시("악보 그리는 중…")가 사라지면 악보가 위로 당겨지므로 그 뒤에 위치를 다시 잰다
  useEffect(() => {
    if (!rendering && hasCursor) updateMarks();
  }, [rendering, hasCursor, updateMarks]);

  const selected = cursor?.selected ?? null;
  const mark = hasCursor && !rendering && marks && marks.xml === xml && selected !== null ? marks.list[selected] : undefined;
  const hasMark = !!mark;

  // 선택 음이 바뀌면 화면 안으로 스크롤
  useEffect(() => {
    if (hasMark) markerRef.current?.scrollIntoView({ block: "nearest", inline: "nearest" });
  }, [selected, hasMark]);

  function onSheetClick(e: React.MouseEvent<HTMLDivElement>) {
    const c = cursorRef.current;
    const sheet = sheetRef.current;
    if (!c || !sheet || !marks || marks.xml !== xml) return;
    const r = sheet.getBoundingClientRect();
    const hit = hitTestMarks(marks.list, e.clientX - r.left + sheet.scrollLeft, e.clientY - r.top + sheet.scrollTop);
    if (hit !== null) c.onSelect(hit);
  }

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
    <div
      ref={sheetRef}
      className={`score-sheet relative overflow-x-auto p-2 ${hasCursor ? "cursor-pointer pt-6 outline-none focus-visible:ring-3 focus-visible:ring-ring/60" : ""} ${className}`}
      {...(hasCursor
        ? { tabIndex: 0, role: "application", "aria-label": "악보 편집 — 방향키로 음표 이동", onClick: onSheetClick }
        : {})}
    >
      {rendering && (
        <div className="no-print flex items-center justify-center gap-2 p-4 text-sm text-neutral-600" aria-live="polite">
          <LoadingSpinner size="sm" />
          <span>악보 그리는 중…</span>
        </div>
      )}
      <div ref={ref} />
      {mark && (
        <span
          ref={markerRef}
          data-testid="score-cursor"
          aria-hidden
          className="no-print pointer-events-none absolute scroll-mb-40 scroll-mt-16 text-[#9184d9]"
          style={{ left: mark.left + mark.width / 2 - 9, top: Math.max(0, mark.top - 20) }}
        >
          <ChevronDown className="size-[18px]" strokeWidth={3.5} />
        </span>
      )}
      {cursor && (
        <p className="sr-only" role="status" aria-live="polite" data-testid="cursor-live">
          {cursor.announce}
        </p>
      )}
      {error && <p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
