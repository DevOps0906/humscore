"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { EDITOR_TABS, type EditorTabId } from "./data";
import { replaceHash, resolveAnchor, smoothScrollTo, useHash } from "./use-hash";

const STAFF_Y = [40, 52, 64, 76, 88];
const NOTES: ReadonlyArray<readonly [number, number]> = [
  [70, 76], [110, 64], [150, 58], [190, 70], [230, 52], [270, 64], [310, 76], [350, 46], [390, 58], [430, 70],
];
const CHORDS: ReadonlyArray<ReadonlyArray<readonly [string, number]>> = [
  [["C", 52], ["F", 168], ["G7", 292]],
  [["Am", 52], ["F", 168], ["C", 292]],
];
const LABELS: Record<EditorTabId, string> = {
  edit: "에디터 화면 예시: 음표 편집",
  chords: "에디터 화면 예시: 마디마다 코드가 붙은 악보",
  transpose: "에디터 화면 예시: C장조에서 D장조로 멜로디 전체가 한 음 위로 이동(점선은 원래 음)",
  perform: "공연 모드 예시: 악보만 크게 표시",
};

/** hash에 탭이 없으면(#editor 등) null → 현재 탭 유지 */
function tabFromHash(hash: string): EditorTabId | null {
  const m = /^#editor-(\w+)$/.exec(hash);
  return EDITOR_TABS.find((t) => t.id === m?.[1])?.id ?? null;
}

/** 에디터 예시. 탭(편집·코드·전조·공연)은 URL hash(#editor-chords 등)와 동기화된다. */
export function EditorDemo() {
  const hash = useHash();
  const [tab, setTab] = useState<EditorTabId>("edit");
  const hashTab = tabFromHash(hash);
  if (hashTab && hashTab !== tab) setTab(hashTab);

  useEffect(() => {
    // 해시로 바로 들어온 경우(새로고침·공유 링크) 에디터 섹션으로 이동
    if (/^#editor-\w+$/.test(window.location.hash)) {
      const el = resolveAnchor("editor");
      if (el) smoothScrollTo(el);
    }
  }, []);

  const select = (id: EditorTabId) => replaceHash(`#editor-${id}`);

  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    const i = EDITOR_TABS.findIndex((t) => t.id === tab);
    let next = -1;
    if (e.key === "ArrowRight") next = (i + 1) % EDITOR_TABS.length;
    else if (e.key === "ArrowLeft") next = (i - 1 + EDITOR_TABS.length) % EDITOR_TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = EDITOR_TABS.length - 1;
    if (next < 0) return;
    e.preventDefault();
    const id = EDITOR_TABS[next].id;
    select(id);
    document.getElementById(`editor-tab-${id}`)?.focus();
  };

  const perform = tab === "perform";
  const shift = tab === "transpose" ? -6 : 0; // 음표 한 칸(5선 반 간격) 위로

  return (
    <div>
      <div role="tablist" aria-label="에디터 기능 미리보기" onKeyDown={onKeyDown} className="mb-3 flex gap-1 overflow-x-auto">
        {EDITOR_TABS.map((t) => {
          const on = t.id === tab;
          return (
            <button
              key={t.id}
              id={`editor-tab-${t.id}`}
              type="button"
              role="tab"
              aria-selected={on}
              aria-controls="editor-panel"
              tabIndex={on ? 0 : -1}
              onClick={() => select(t.id)}
              className={`min-h-[var(--tap-min)] flex-none rounded-lg px-4 text-sm transition-colors ${
                on ? "bg-section text-lavender-100" : "text-ink-soft hover:text-ink"
              }`}
            >
              {t.label}
            </button>
          );
        })}
      </div>
      <div
        id="editor-panel"
        role="tabpanel"
        tabIndex={0}
        aria-labelledby={`editor-tab-${tab}`}
        className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl bg-surface shadow-[var(--shadow-sm)]"
      >
        <svg
          viewBox={perform ? "40 20 250 156" : "0 0 480 300"}
          className="size-full"
          role="img"
          aria-label={LABELS[tab]}
        >
          {perform ? (
            <>
              <rect x="40" y="20" width="250" height="156" fill="var(--score-paper)" />
              <Staff y={34} notes={NOTES.slice(0, 6)} lineTo={290} />
            </>
          ) : (
            <>
              <rect x="16" y="16" width="448" height="28" rx="6" fill="var(--tono-bg)" />
              <circle cx="34" cy="30" r="5" fill="var(--tono-accent)" />
              <rect x="50" y="26" width="120" height="8" rx="4" fill="var(--tono-gray-700)" />
              <text x="448" y="34" textAnchor="end" fontSize="12" fill="var(--tono-lavender-100)">
                {tab === "transpose" ? "C → D" : "C"}
              </text>
              <rect x="16" y="56" width="448" height="228" rx="8" fill="var(--score-paper)" />
              {[0, 1].map((r) => (
                <g key={r} transform={`translate(0 ${r * 118 + 50})`}>
                  {tab === "chords" &&
                    CHORDS[r].map(([name, x]) => (
                      <g key={name + x}>
                        <rect x={x - 8} y="10" width={name.length * 9 + 16} height="18" rx="4" fill="var(--tono-accent)" />
                        <text x={x} y="23" fontSize="12" fontWeight="600" fill="var(--tono-bg)">
                          {name}
                        </text>
                      </g>
                    ))}
                  <Staff y={0} notes={NOTES} shift={shift} ghost={tab === "transpose"} accentIndex={r === 0 ? 4 : -1} />
                </g>
              ))}
            </>
          )}
        </svg>
        {perform && (
          <p className="absolute inset-x-0 bottom-3 mx-auto w-fit rounded-full bg-paper/80 px-3 py-1 text-xs text-ink">탭해서 넘기기</p>
        )}
      </div>
    </div>
  );
}

function Staff({
  y,
  notes,
  shift = 0,
  accentIndex = -1,
  lineTo = 440,
  ghost = false,
}: {
  y: number;
  notes: ReadonlyArray<readonly [number, number]>;
  shift?: number;
  accentIndex?: number;
  lineTo?: number;
  ghost?: boolean;
}) {
  return (
    <g transform={`translate(0 ${y})`}>
      {STAFF_Y.map((ly) => (
        <line key={ly} x1="40" x2={lineTo} y1={ly} y2={ly} stroke="var(--tono-gray-400)" strokeWidth="1" />
      ))}
      {ghost &&
        notes.map(([x, ny], i) => (
          <ellipse key={`g${i}`} cx={x} cy={ny} rx="6" ry="4.5" fill="none" stroke="var(--tono-gray-400)" strokeDasharray="2 2" />
        ))}
      {notes.map(([x, ny], i) => {
        const cy = ny + shift;
        const color = i === accentIndex ? "var(--tono-accent)" : "var(--tono-bg)";
        return (
          <g key={i}>
            <ellipse cx={x} cy={cy} rx="6" ry="4.5" fill={color} />
            <line x1={x + 5.5} x2={x + 5.5} y1={cy} y2={cy - 26} stroke={color} />
          </g>
        );
      })}
    </g>
  );
}
