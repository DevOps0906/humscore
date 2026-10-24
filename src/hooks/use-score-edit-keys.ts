"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { applyEditKey } from "@/components/score-cursor";
import type { NoteEvent } from "@/lib/music/types";

/** 편집 모드 키보드 처리 (window keydown). 입력창·select·대화상자 안에서는 동작하지 않음 */
export function useScoreEditKeys(opts: {
  enabled: boolean;
  notes: NoteEvent[];
  selected: number | null;
  transpose: number;
  setSelected: (i: number | null) => void;
  onChange: (notes: NoteEvent[]) => void;
  playNote: (midi: number, o?: { duration?: number }) => void;
  /** 지정하면 Esc 로 호출 (편집 도구 모음 닫기 등) */
  onEscape?: () => void;
}) {
  const ref = useRef(opts);
  useLayoutEffect(() => {
    ref.current = opts;
  });

  useEffect(() => {
    if (!opts.enabled) return;
    const handler = (e: KeyboardEvent) => {
      const o = ref.current;
      if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
      const t = e.target as HTMLElement | null;
      if (t) {
        const tag = t.tagName;
        if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || t.isContentEditable) return;
        if (tag === "BUTTON" && (e.key === "Enter" || e.key === " ")) return;
      }
      // 열려서 실제로 보이는 대화상자가 있으면 무시 (닫힌 뒤 남은 숨은 노드는 제외)
      const openDialog = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"],[role="alertdialog"]')).some(
        (d) => d.getAttribute("data-state") !== "closed" && d.checkVisibility?.({ opacityProperty: true, visibilityProperty: true }) !== false && d.getClientRects().length > 0,
      );
      if (openDialog) return;
      if (e.key === "Escape") {
        if (o.onEscape) {
          e.preventDefault();
          o.onEscape();
        }
        return;
      }
      const r = applyEditKey(o.notes, o.selected, e.key, e.shiftKey);
      if (!r) return;
      e.preventDefault();
      if (r.notes) o.onChange(r.notes);
      if (r.sel !== o.selected) o.setSelected(r.sel);
      if (r.play !== undefined) o.playNote(r.play + o.transpose, { duration: 0.4 }); // keydown = 사용자 제스처
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [opts.enabled]);
}
