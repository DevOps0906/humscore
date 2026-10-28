"use client";

import { useEffect, useState, type CSSProperties, type KeyboardEvent } from "react";
import Image from "next/image";
import { EDITOR_TABS, type EditorTabId } from "./data";
import { replaceHash, resolveAnchor, smoothScrollTo, useHash } from "./use-hash";
import styles from "./landing.module.css";

/** public/landing/hero-score.svg(1240×904) 좌표. 오버레이는 CSS에서 --x/--y/--w/--h를 1240·904로 나눠 %로 배치한다. */
type Box = { x: number; y: number; w: number; h: number };
const box = ({ x, y, w, h }: Box, extra?: Record<string, number>) =>
  ({ "--x": x, "--y": y, "--w": w, "--h": h, ...extra }) as CSSProperties;

/** 편집 탭에서 선택된 음표(2마디 셋째 음) */
const SELECTED: Box = { x: 515, y: 136, w: 22, h: 20 };
/** 악보 코드 기호: [이름, x, 기준선 y, 단(0~2)] */
const CHORDS: ReadonlyArray<readonly [string, number, number, number]> = [
  ["G", 120, 90, 0], ["C", 399, 90, 0], ["Em", 674, 90, 0], ["D7", 978, 90, 0],
  ["G", 94, 347, 1], ["C", 394, 347, 1], ["Am", 676, 347, 1], ["D7", 949, 347, 1],
  ["G", 92, 642, 2], ["Em", 422, 642, 2], ["B7", 575, 642, 2], ["Am", 688, 642, 2], ["D7", 833, 642, 2], ["G", 991, 642, 2],
];
const LABELS: Record<EditorTabId, string> = {
  edit: "에디터 화면 예시: 12마디 피아노 악보에서 음표 하나를 선택해 편집",
  chords: "에디터 화면 예시: 단마다 코드(G·C·Em·D7 등)가 강조된 악보",
  transpose: "에디터 화면 예시: G장조에서 A장조로 악보 전체가 한 칸 위로 이동(점선은 원래 위치)",
  perform: "공연 모드 예시: 재생 위치가 단을 따라 이동하는 악보",
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

  const transpose = tab === "transpose";

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
        className={styles.edPanel}
        data-tab={tab}
      >
        <div className={styles.edStage} role="img" aria-label={LABELS[tab]}>
          {transpose && (
            <span className={styles.edGhost} aria-hidden>
              <Image src="/landing/hero-score.svg" alt="" width={1240} height={904} className={styles.edImg} unoptimized />
            </span>
          )}
          <Image
            src="/landing/hero-score.svg"
            alt=""
            width={1240}
            height={904}
            className={`${styles.edImg} ${styles.edScore}`}
            data-up={transpose || undefined}
            unoptimized
          />
          {tab === "edit" && (
            <>
              <span className={styles.edSel} style={box(SELECTED)} />
              <span className={styles.edCaret} style={box(SELECTED)} />
            </>
          )}
          {tab === "chords" &&
            CHORDS.map(([name, x, y, row], i) => (
              <span
                key={`${name}${x}${y}`}
                className={styles.edChip}
                style={box({ x: x - 6, y: y - 16, w: name.length * 11 + 12, h: 22 }, { "--row": row, "--i": i })}
              />
            ))}
          {tab === "perform" && <span className={styles.edPlay} />}
        </div>
        {transpose && <p className={styles.edBadge}>G → A</p>}
        {tab === "perform" && <p className={styles.edHint}>탭해서 넘기기</p>}
      </div>
    </div>
  );
}
