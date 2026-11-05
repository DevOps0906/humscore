"use client";

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import type { OpenSheetMusicDisplay } from "opensheetmusicdisplay";
import { ChevronDown } from "lucide-react";
import { LoadingSpinner } from "@/components/loading-spinner";
import { formatCreditLines } from "@/components/score-header-logic";
import { beatKey, dragSteps, hitTestMarks, noteIndexByStart, type MarkRect } from "@/components/score-cursor";
import type { ChordEvent, NoteEvent } from "@/lib/music/types";

const DEBOUNCE_MS = 200;
const MEASURES_PER_LINE = 4;

/** SVG의 원본 좌표는 그대로 두고 화면에 놓이는 종이만 비례 축소한다. */
function fitPages(container: HTMLElement, enabled: boolean) {
  if (!enabled) return;
  const maxHeight = window.innerHeight * 0.74;
  container.style.minWidth = "";
  container.style.width = "100%";
  const available = container.clientWidth;
  for (const svg of container.querySelectorAll("svg")) {
    const { width, height } = svg.viewBox.baseVal;
    if (!width || !height) continue;
    const scale = Math.min(1, available / width, maxHeight / height);
    svg.style.width = `${width * scale}px`;
    svg.style.height = `${height * scale}px`;
    svg.style.display = "block";
    svg.style.maxWidth = "100%";
    svg.style.marginInline = "auto";
    const page = svg.parentElement;
    if (page && page !== container) {
      page.style.width = "100%";
      page.style.height = `${height * scale}px`;
    }
  }
}

function creditLines(xml: string) {
  const doc = new DOMParser().parseFromString(xml, "application/xml");
  const creator = (type: string) => Array.from(doc.querySelectorAll("identification > creator"))
    .find((entry) => entry.getAttribute("type") === type)?.textContent ?? "";
  return formatCreditLines({ lyricist: creator("lyricist"), composer: creator("composer"), arranger: creator("arranger") });
}

/** OSMD의 합쳐진 저작자 행 대신 역할별로 독립된 텍스트 행을 그린다. */
function drawCreditLines(osmd: OpenSheetMusicDisplay, container: HTMLElement, lines: string[]) {
  const svg = container.querySelector("svg");
  if (!svg || !lines.length) return;
  const firstSystem = osmd.GraphicSheet?.MusicPages[0]?.MusicSystems[0];
  const k = 10 * osmd.zoom;
  const top = (firstSystem?.PositionAndShape.AbsolutePosition.y ?? 12) * k;
  const lineHeight = 1.6 * k;
  const x = svg.viewBox.baseVal.width - osmd.EngravingRules.PageRightMargin * k;
  const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
  group.dataset.scoreCredits = "true";
  lines.forEach((line, index) => {
    const text = document.createElementNS("http://www.w3.org/2000/svg", "text");
    text.setAttribute("x", String(x));
    text.setAttribute("y", String(top - (lines.length - index) * lineHeight));
    text.setAttribute("text-anchor", "end");
    text.setAttribute("font-size", String(1.2 * k));
    text.setAttribute("fill", "#111");
    text.textContent = line;
    group.appendChild(text);
  });
  svg.appendChild(group);
}

/** 음표가 빽빽하거나 화면이 좁아도 네 마디가 한 줄에 남도록 종이의 최소 폭을 구한다. */
function renderFourMeasureLines(osmd: OpenSheetMusicDisplay, container: HTMLElement) {
  container.style.minWidth = "";
  const rules = osmd.EngravingRules;
  rules.FixedMeasureWidth = false;
  rules.LastSystemMaxScalingFactor = 1;
  for (const staves of osmd.GraphicSheet?.MeasureList ?? []) {
    if (staves[0]) staves[0].parentSourceMeasure.WidthFactor = 1;
  }
  osmd.render();
  const measures = osmd.GraphicSheet?.MeasureList ?? [];
  let widestMeasure = 0;
  for (const staves of measures) {
      widestMeasure = Math.max(widestMeasure, ...staves.map((measure) =>
        measure.minimumStaffEntriesWidth + measure.beginInstructionsWidth + measure.endInstructionsWidth,
      ));
  }
  // 줄 시작의 음자리표·조표와 페이지 여백을 포함한다.
  const margin = rules.PageLeftMargin + rules.PageRightMargin + rules.SystemLeftMargin + rules.SystemRightMargin;
  const minimumWidth = Math.ceil((widestMeasure * MEASURES_PER_LINE * 1.2 + margin) * 10 * osmd.zoom);
  if (minimumWidth > 0) {
    container.style.minWidth = `${minimumWidth}px`;
    osmd.render();
    // 음자리표·박자표까지 포함한 전체 마디 폭을 맞춘다. 음표 글리프는 늘이지 않는다.
    // 첫 계산에서 줄바꿈이 달라질 수 있어 지시 기호 폭을 다시 읽어 수렴시킨다.
    for (let pass = 0; pass < 3; pass++) {
      const current = osmd.GraphicSheet?.MeasureList ?? [];
      const labelWidth = Math.max(0, ...(osmd.GraphicSheet?.MusicPages ?? []).flatMap((page) => page.MusicSystems.map((system) => system.MaxLabelLength > 0 ? system.MaxLabelLength + rules.SystemLabelsRightMargin : 0)));
      const pageWidth = Math.min(container.clientWidth / (10 * osmd.zoom), osmd.GraphicSheet?.MusicPages[0]?.PositionAndShape.Size.width ?? Infinity);
      // 빈 총보도 줄 끝 세로선과 보표 내부 여백을 포함해 네 마디가 들어가게 한다.
      const slot = (pageWidth - margin - labelWidth - rules.MeasureLeftMargin - 0.02) / MEASURES_PER_LINE * 0.9;
      for (const staves of current) {
        const source = staves[0]?.parentSourceMeasure;
        if (!source) continue;
        const factor = source.WidthFactor || 1;
        const natural = Math.max(0.1, ...staves.map((measure) => measure.minimumStaffEntriesWidth / factor));
        const instructions = Math.max(0, ...staves.map((measure) => measure.beginInstructionsWidth + measure.endInstructionsWidth));
        source.WidthFactor = Math.max(1, (slot - instructions) / natural);
      }
      osmd.render();
    }
  }
  for (const svg of container.querySelectorAll("svg")) {
    const width = svg.width.baseVal.value;
    const height = svg.height.baseVal.value;
    if (width > 0 && height > 0) svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  }
}

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

export interface ScoreChordEditorProps {
  chords: ChordEvent[];
  onSelect: (startBeat: number) => void;
}

interface ChordMark extends MarkRect {
  startBeat: number;
  label: string;
}

/** 렌더된 코드의 SVG 문자 위치에 마우스·터치·키보드 공용 버튼을 겹친다. */
function computeChordMarks(osmd: OpenSheetMusicDisplay, sheet: HTMLElement, chords: ChordEvent[]): ChordMark[] {
  const base = sheet.getBoundingClientRect();
  return (osmd.GraphicSheet?.MeasureList ?? []).flatMap((staves) => {
    const measure = staves[0];
    if (!measure) return [];
    const measureStart = measure.parentSourceMeasure.AbsoluteTimestamp.RealValue * 4;
    const measureEnd = measureStart + measure.parentSourceMeasure.Duration.RealValue * 4;
    const events = chords.filter((chord) => chord.startBeat >= measureStart - 1e-6 && chord.startBeat < measureEnd - 1e-6).sort((left, right) => left.startBeat - right.startBeat);
    // MusicXML harmony offset은 OSMD staff entry의 timestamp에 반영되지 않는다.
    // 같은 마디의 코드 컨테이너는 XML 순서이므로 실제 코드 이벤트와 순서로 연결한다.
    return measure.staffEntries.flatMap((entry) => entry.graphicalChordContainers).flatMap((container, index) => {
        const chord = events[index];
        if (!chord) return [];
        const node = container.GraphicalLabel.SVGNode;
        if (!(node instanceof SVGElement)) return [];
        const box = node.getBoundingClientRect();
        if (!box.width || !box.height) return [];
        return [{ startBeat: chord.startBeat, label: node.textContent ?? "코드", left: box.left - base.left + sheet.scrollLeft,
          top: box.top - base.top + sheet.scrollTop, width: box.width, height: box.height }];
    });
  });
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
      // SVG는 다음 XML을 로드하는 동안에도 보인다. 현재 음표와 대조할 수 있는
      // 원본 식별자를 붙여 코드 변경 직후의 빠른 클릭·터치도 놓치지 않는다.
      g.dataset.scoreNoteStart = String(notes[idx].startBeat);
      g.dataset.scoreNoteMidi = String(notes[idx].midi);
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
  chordEditor,
  showHeader = false,
  printLayout = true,
  fitToPage = true,
  header,
  onHandle,
}: {
  xml: string;
  zoom?: number;
  className?: string;
  cursor?: ScoreCursorProps;
  chordEditor?: ScoreChordEditorProps;
  /** MusicXML 의 제목·작곡자를 악보 맨 위에 그림 (생성 시점에만 반영) */
  showHeader?: boolean;
  /** 출력용 총보는 A4 페이지에서 시스템(줄)을 통째로 나눈다. */
  printLayout?: boolean;
  /** 화면의 한 페이지를 가로·세로에 맞춘다. 인쇄/PDF 원본은 false를 사용한다. */
  fitToPage?: boolean;
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
  const chordEditorRef = useRef(chordEditor);
  useLayoutEffect(() => {
    cursorRef.current = cursor;
    chordEditorRef.current = chordEditor;
  });
  const [marks, setMarks] = useState<{ xml: string; list: (MarkRect | undefined)[] } | null>(null);
  const [chordMarks, setChordMarks] = useState<{ xml: string; list: ChordMark[] } | null>(null);
  const hasCursor = !!cursor;
  const hasChordEditor = !!chordEditor;
  const interactive = hasCursor || hasChordEditor;

  const updateMarks = useCallback(() => {
    const c = cursorRef.current;
    const osmd = osmdRef.current;
    const loaded = loadedXml.current;
    if (!osmd || !sheetRef.current || loaded === null) return;
    try {
      if (c) setMarks({ xml: loaded, list: computeMarks(osmd, sheetRef.current, c.notes) });
      const editor = chordEditorRef.current;
      if (editor) setChordMarks({ xml: loaded, list: computeChordMarks(osmd, sheetRef.current, editor.chords) });
    } catch {
      setMarks(null);
      setChordMarks(null);
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
              autoResize: false,
              newSystemFromXML: false, // 화면 폭과 무관하게 아래의 4마디 단위 배치를 사용
              setWantedStemDirectionByXml: true,
              backend: "svg",
              drawTitle: showHeader,
              drawComposer: false,
              drawPartNames: false,
              pageFormat: printLayout ? "A4_P" : "Endless",
              drawingParameters: "compacttight",
              autoGenerateMultipleRestMeasuresFromRestMeasures: false, // 빈 마디를 "7" 식 다중쉼표로 합치지 않음 (8마디 미리보기)
              stretchLastSystemLine: false, // 마지막 1~3마디도 기존 마디 폭 유지
            });
            osmdRef.current.EngravingRules.RenderXMeasuresPerLineAkaSystem = MEASURES_PER_LINE;
            osmdRef.current.EngravingRules.NewPartAndSystemAfterFinalBarline = false;
          }
          const osmd = osmdRef.current;
          const multipleInstruments = xml.includes('id="M1-');
          osmd.setOptions({ drawTitle: showHeader, drawComposer: false, drawLyricist: false, drawPartNames: multipleInstruments, drawPartAbbreviations: multipleInstruments });
          if (showHeader) {
            // 기본값은 제목이 너무 커서 긴 제목이 잘림 → 작게
            osmd.EngravingRules.SheetTitleHeight = 2;
            osmd.EngravingRules.SheetComposerHeight = 1.2;
            osmd.EngravingRules.TitleTopDistance = 1.5;
            osmd.EngravingRules.TitleBottomDistance = 2 + creditLines(xml).length * 1.6;
          }
          if (loadedXml.current !== xml) {
            loadedXml.current = null; // load 도중 상태 불명 → 완료 전까지 null
            await osmd.load(xml);
            loadedXml.current = xml; // 취소돼도 OSMD 내부에는 이 xml이 load됨
            if (!isLatest()) return;
          }
          osmd.zoom = zoom;
          if (fitToPage) ref.current.style.width = `${Math.max(720, sheetRef.current?.clientWidth ?? 720)}px`;
          renderFourMeasureLines(osmd, ref.current);
          if (showHeader) drawCreditLines(osmd, ref.current, creditLines(xml));
          fitPages(ref.current, fitToPage);
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
  }, [xml, zoom, updateMarks, showHeader, printLayout, fitToPage]);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet) return;
    let width = sheet.clientWidth;
    let height = window.innerHeight;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const resize = () => {
      if (window.matchMedia("print").matches) return;
      if (Math.abs(sheet.clientWidth - width) < 1 && Math.abs(window.innerHeight - height) < 1) return;
      width = sheet.clientWidth;
      height = window.innerHeight;
      clearTimeout(timer);
      timer = setTimeout(() => {
        if (osmdRef.current && ref.current && loadedXml.current) {
          if (fitToPage) ref.current.style.width = `${Math.max(720, sheet.clientWidth)}px`;
          renderFourMeasureLines(osmdRef.current, ref.current);
          if (showHeader) drawCreditLines(osmdRef.current, ref.current, creditLines(loadedXml.current));
          fitPages(ref.current, fitToPage);
          updateMarks();
        }
      }, DEBOUNCE_MS);
    };
    const observer = new ResizeObserver(resize);
    observer.observe(sheet);
    window.addEventListener("resize", resize);
    return () => { observer.disconnect(); window.removeEventListener("resize", resize); clearTimeout(timer); };
  }, [updateMarks, fitToPage, showHeader]);

  // 커서 모드: OSMD 가 자체적으로 다시 그릴 때(창 크기 변경 등)도 위치 재계산
  useEffect(() => {
    const el = ref.current;
    if (!interactive || !el) return;
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
  }, [interactive, updateMarks]);

  // 머리글 높이가 바뀌면(글자 크기·글꼴, 줄바꿈, 웹폰트 로딩) 그 아래 악보가 밀리므로 좌표를 다시 잰다
  const headerRef = useRef<HTMLDivElement>(null);
  const hasHeader = !!header;
  useEffect(() => {
    const el = headerRef.current;
    if (!interactive || !hasHeader || !el || typeof ResizeObserver === "undefined") return;
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
  }, [interactive, hasHeader, updateMarks]);

  // 로딩 표시("악보 그리는 중…")가 사라지면 악보가 위로 당겨지므로 그 뒤에 위치를 다시 잰다
  useEffect(() => {
    if (!rendering && interactive) updateMarks();
  }, [rendering, interactive, updateMarks]);

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
    if (!c || !sheet) return;
    const target = e.target instanceof Element ? e.target.closest<SVGElement>("[data-score-note-start]") : null;
    if (target && sheet.contains(target)) {
      const start = Number(target.dataset.scoreNoteStart);
      const index = c.notes.findIndex((note) => Math.abs(note.startBeat - start) < 1e-6 && String(note.midi) === target.dataset.scoreNoteMidi);
      if (index >= 0) { c.onSelect(index); return; }
    }
    if (!marks || marks.xml !== xml) return;
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
    const svg = ref.current?.querySelector("svg");
    const scale = svg && svg.viewBox.baseVal.width ? svg.getBoundingClientRect().width / svg.viewBox.baseVal.width : 1;
    const steps = dragSteps(d.startY, e.clientY, 10 * (osmdRef.current?.zoom ?? 1) * scale);
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
      <div ref={ref} aria-busy={rendering} />
      {chordEditor && !rendering && chordMarks?.xml === xml && chordMarks.list.map((chord, index) => (
        <button
          key={`${chord.startBeat}:${index}`}
          type="button"
          data-testid="score-chord-target"
          data-start-beat={chord.startBeat}
          aria-label={`코드 ${chord.label} 변경`}
          onClick={(event) => { event.stopPropagation(); chordEditor.onSelect(chord.startBeat); }}
          className="no-print absolute z-10 cursor-pointer rounded-md border border-transparent bg-transparent outline-none hover:border-accent hover:bg-accent/10 focus-visible:border-accent focus-visible:ring-3 focus-visible:ring-ring/60"
          style={{ left: chord.left - 4, top: chord.top - 2, width: Math.max(24, chord.width + 8), height: chord.height + 4 }}
        />
      ))}
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
          onClick={(event) => { event.stopPropagation(); if (selected !== null) cursorRef.current?.onSelect(selected); }}
          className="no-print absolute z-20 cursor-ns-resize touch-none rounded-md"
          style={{
            left: mark.left + mark.width / 2 - 12,
            top: Math.max(0, mark.top - 24),
            width: 24,
            height: 20,
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
          className="no-print absolute z-10 max-h-[45dvh] w-max max-w-[min(24rem,calc(100%-8px))] overflow-y-auto scroll-mb-44 scroll-mt-16 rounded-xl border border-line bg-surface p-2 text-ink shadow-lg"
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
