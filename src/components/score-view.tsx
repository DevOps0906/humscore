"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { ChevronDown } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { beatKey, dragSteps, hitTestMarks, noteIndexByStart, type MarkRect } from "@/components/score-cursor";
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
  /** 음표를 클릭·탭해서 고른 경우 (도구 모음을 여는 신호) */
  /** 편집 도구 모음 내용. toolbarOpen 일 때 ▼ 옆에 뜸 */
  toolbar?: ReactNode;
  toolbarOpen: boolean;
  /** 빈 곳을 눌렀을 때 */
  onDismiss: () => void;
  /** 선택 음을 위아래로 끌 때 표시할 음 이름. 끌 수 없으면(쉼표 등) null */
  dragLabel: (steps: number) => string | null;
  /** 끄는 동안 단계가 바뀔 때(미리듣기). steps=0 은 누른 직후 */
  onDragPreview: (steps: number) => void;
  /** 손을 뗄 때 확정 */
  onDragCommit: (steps: number) => void;
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

/** PDF 내보내기용: OSMD 가 그린 컨테이너와 시스템(줄)별 세로 범위 */
export interface ScoreViewHandle {
  /** OSMD 가 SVG 를 그린 컨테이너 */
  container: HTMLElement;
  /** OSMD 가 제목·작곡자를 SVG 안에 그렸는지 (true 면 별도 머리글 불필요) */
  drawsTitle: boolean;
  /** SVG(페이지)별 시스템의 세로 범위(px, SVG 위쪽 기준). 못 구하면 [] */
  systemSpans: () => { top: number; bottom: number }[][];
}

interface BoxLike {
  AbsolutePosition: { y: number };
  BorderTop: number;
  BorderBottom: number;
}
interface SheetLike {
  MusicPages?: { MusicSystems?: { PositionAndShape?: BoxLike }[] }[];
}

/** OSMD 단위 → px: 단위 × 10 × zoom */
function computeSystemSpans(osmd: OpenSheetMusicDisplay): { top: number; bottom: number }[][] {
  const pages = (osmd.GraphicSheet as unknown as SheetLike | undefined)?.MusicPages ?? [];
  const k = 10 * osmd.zoom;
  return pages.map((p) =>
    (p.MusicSystems ?? []).flatMap((s) => {
      const b = s.PositionAndShape;
      if (!b) return [];
      return [{ top: (b.AbsolutePosition.y + b.BorderTop) * k, bottom: (b.AbsolutePosition.y + b.BorderBottom) * k }];
    }),
  );
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
  showHeader = false,
  header,
  onHandle,
}: {
  xml: string;
  zoom?: number;
  className?: string;
  cursor?: ScoreCursorProps;
  /** MusicXML 의 제목·작곡자를 악보 맨 위에 그림 (생성 시점에만 반영) */
  showHeader?: boolean;
  /** 악보(종이) 맨 위, OSMD 그림 앞에 놓는 HTML 머리글 (인쇄에 포함됨) */
  header?: ReactNode;
  /** PDF 내보내기용 핸들을 받는다 (언마운트 때 null) */
  onHandle?: (h: ScoreViewHandle | null) => void;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const onHandleRef = useRef(onHandle);
  useLayoutEffect(() => {
    onHandleRef.current = onHandle;
  });
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    onHandleRef.current?.({
      container: el,
      drawsTitle: showHeader,
      systemSpans: () => {
        try {
          return osmdRef.current ? computeSystemSpans(osmdRef.current) : [];
        } catch {
          return [];
        }
      },
    });
    return () => onHandleRef.current?.(null);
  }, [showHeader]);
  const sheetRef = useRef<HTMLDivElement>(null);
  const markerRef = useRef<HTMLSpanElement>(null);
  const cursorRef = useRef(cursor);
  useLayoutEffect(() => {
    cursorRef.current = cursor;
  });
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
              drawTitle: showHeader,
              drawComposer: showHeader,
              drawPartNames: false,
              drawingParameters: "compacttight",
              autoGenerateMultipleRestMeasuresFromRestMeasures: false, // 빈 마디를 "7" 식 다중쉼표로 합치지 않음 (8마디 미리보기)
            });
          }
          const osmd = osmdRef.current;
          if (showHeader) {
            // 기본값은 제목이 너무 커서 긴 제목이 잘림 → 작게
            osmd.EngravingRules.SheetTitleHeight = 2;
            osmd.EngravingRules.SheetComposerHeight = 1.2;
            osmd.EngravingRules.TitleTopDistance = 1.5;
          }
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
  }, [xml, zoom, updateMarks, showHeader]);

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

  // 머리글 높이가 바뀌면(글자 크기·글꼴, 줄바꿈, 웹폰트 로딩) 그 아래 악보가 밀리므로 좌표를 다시 잰다
  const headerRef = useRef<HTMLDivElement>(null);
  const hasHeader = !!header;
  useEffect(() => {
    const el = headerRef.current;
    if (!hasCursor || !hasHeader || !el || typeof ResizeObserver === "undefined") return;
    let raf = 0;
    const ro = new ResizeObserver(() => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(updateMarks);
    });
    ro.observe(el);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [hasCursor, hasHeader, updateMarks]);

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
    const hit = hitTestMarks(marks.list, e.clientX - r.left + sheet.scrollLeft, e.clientY - r.top + sheet.scrollTop, 14);
    if (hit !== null) c.onSelect(hit);
    else c.onDismiss();
  }

  // ---- 선택 음을 위아래로 끌어 음높이 바꾸기 (Pointer Events: 마우스·터치 공용) ----
  const dragRef = useRef<{ id: number; startY: number; last: number; moved: boolean } | null>(null);
  const [drag, setDrag] = useState<number | null>(null);
  const canDrag = hasCursor && selected !== null && !!cursor!.dragLabel(0);

  function onHandleDown(e: React.PointerEvent<HTMLDivElement>) {
    if (!canDrag || (e.pointerType === "mouse" && e.button !== 0)) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = { id: e.pointerId, startY: e.clientY, last: 0, moved: false };
    cursorRef.current?.onDragPreview(0); // 누르는 순간(제스처)에 소리를 열고 현재 음을 들려줌
  }
  function onHandleMove(e: React.PointerEvent<HTMLDivElement>) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    if (!d.moved && Math.abs(e.clientY - d.startY) < 4) return;
    d.moved = true;
    const steps = dragSteps(d.startY, e.clientY);
    if (steps !== d.last) {
      d.last = steps;
      setDrag(steps);
      cursorRef.current?.onDragPreview(steps);
    } else if (drag === null) setDrag(steps);
  }
  function endDrag(e: React.PointerEvent<HTMLDivElement>, commit: boolean) {
    const d = dragRef.current;
    if (!d || d.id !== e.pointerId) return;
    dragRef.current = null;
    setDrag(null);
    if (commit && d.moved && d.last !== 0) cursorRef.current?.onDragCommit(d.last);
  }

  // ---- 편집 도구 모음 위치: ▼ 옆, 화면 밖으로 나가면 위/아래 뒤집기 ----
  const toolbarRef = useRef<HTMLDivElement>(null);
  const [tbPos, setTbPos] = useState<{ left: number; top: number; below: boolean; h: number } | null>(null);
  const toolbarShown = !!(cursor?.toolbarOpen && cursor.toolbar && mark && drag === null);
  const mLeft = mark?.left;
  const mTop = mark?.top;
  const mW = mark?.width;
  const mH = mark?.height;
  useLayoutEffect(() => {
    const tb = toolbarRef.current;
    const sheet = sheetRef.current;
    if (!toolbarShown || !tb || !sheet || mLeft === undefined || mTop === undefined || mW === undefined || mH === undefined) return;
    const w = tb.offsetWidth;
    const h = tb.offsetHeight;
    const cx = mLeft + mW / 2;
    const left = Math.max(sheet.scrollLeft + 4, Math.min(cx - w / 2, sheet.scrollLeft + sheet.clientWidth - w - 4));
    const belowTop = mTop + mH + 10;
    const aboveTop = mTop - 26 - h;
    const sheetTop = sheet.getBoundingClientRect().top - sheet.scrollTop;
    const fitsBelow = sheetTop + belowTop + h <= window.innerHeight - 150; // 하단 고정 바 위
    const fitsAbove = aboveTop >= 0 && sheetTop + aboveTop >= 8;
    const below = fitsBelow || !fitsAbove;
    setTbPos({ left, top: below ? belowTop : aboveTop, below, h });
  }, [toolbarShown, mLeft, mTop, mW, mH, cursor?.selected]);

  // 도구 모음이 하단 고정 바(재생·전조)에 가리지 않게 위치가 정해지면 화면 안으로 스크롤
  const tbReady = !!tbPos;
  useEffect(() => {
    const tb = toolbarRef.current;
    if (!toolbarShown || !tbReady || !tb) return;
    const over = tb.getBoundingClientRect().bottom - (window.innerHeight - 220); // 하단 고정 바(재생·전조) 위까지
    if (over > 0) window.scrollBy({ top: over });
  }, [toolbarShown, tbReady, mLeft, mTop]);

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
      {header && <div ref={headerRef}>{header}</div>}
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
      {hasCursor && canDrag && mark && (
        <div
          data-testid="score-handle"
          aria-hidden
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={(e) => endDrag(e, true)}
          onPointerCancel={(e) => endDrag(e, false)}
          className="no-print absolute cursor-ns-resize touch-none rounded-md"
          style={{
            left: mark.left + mark.width / 2 - Math.max(mark.width / 2 + 8, 18),
            top: mark.top - 4,
            width: Math.max(mark.width + 16, 36),
            height: mark.height + 8,
          }}
        />
      )}
      {mark && drag !== null && cursor && (
        <span
          data-testid="score-drag-label"
          aria-hidden
          className="no-print pointer-events-none absolute z-10 -translate-x-1/2 rounded-md bg-[#9184d9] px-1.5 py-0.5 text-xs font-medium text-white shadow"
          style={{ left: mark.left + mark.width / 2, top: Math.max(0, mark.top - 46) }}
        >
          {cursor.dragLabel(drag) ?? ""}
        </span>
      )}
      {toolbarShown && mark && cursor && (
        <div
          ref={toolbarRef}
          onClick={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          className="no-print absolute z-10 w-max max-w-[min(24rem,calc(100%-8px))] scroll-mb-44 scroll-mt-16 rounded-xl border border-line bg-surface p-2 text-ink shadow-lg"
          style={{ left: tbPos?.left ?? 0, top: tbPos?.top ?? 0, visibility: tbPos ? "visible" : "hidden", cursor: "default" }}
        >
          {cursor.toolbar}
        </div>
      )}
      {toolbarShown && tbPos?.below && <div aria-hidden style={{ height: tbPos.h + 16 }} />}
      {cursor && (
        <p className="sr-only" role="status" aria-live="polite" data-testid="cursor-live">
          {cursor.announce}
        </p>
      )}
      {error && <p role="alert" className="p-4 text-sm text-red-700">{error}</p>}
    </div>
  );
}
