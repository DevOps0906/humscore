"use client";

import { useEffect, useRef, useState } from "react";
import { Pencil } from "lucide-react";
import { Input } from "@/components/ui/input";

/**
 * 제목·작곡자 같은 한 줄 인라인 입력.
 * Enter = 저장 + blur, Esc = 되돌리고 blur, blur = 저장. 앞뒤 공백 제거.
 * onCommit 은 값이 실제로 바뀐 경우에만 호출 (빈 값은 allowEmpty 일 때만 허용)
 */
export function InlineField({
  value,
  label,
  ariaLabel,
  placeholder,
  allowEmpty = false,
  onCommit,
  className = "",
}: {
  value: string;
  label: string;
  ariaLabel: string;
  placeholder?: string;
  allowEmpty?: boolean;
  onCommit: (trimmed: string) => void;
  className?: string;
}) {
  const [draft, setDraft] = useState(value);
  const last = useRef(value);
  const reverting = useRef(false);
  // value 가 바깥에서 바뀌면 렌더 중에 draft 를 맞춘다 (effect 안 setState 대신)
  const [prevValue, setPrevValue] = useState(value);
  if (prevValue !== value) {
    setPrevValue(value);
    setDraft(value);
  }
  useEffect(() => {
    last.current = value;
  }, [value]);

  function commit() {
    const t = draft.trim();
    if (t === last.current) {
      setDraft(t);
      return;
    }
    if (!t && !allowEmpty) {
      setDraft(last.current);
      return;
    }
    last.current = t;
    setDraft(t);
    onCommit(t);
  }

  return (
    <label className={`flex items-center gap-2 ${className}`}>
      <span className="flex shrink-0 items-center gap-1 text-xs text-ink-soft">
        <Pencil className="size-3.5" aria-hidden />
        {label}
      </span>
      <Input
        value={draft}
        placeholder={placeholder}
        maxLength={100}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => {
          if (reverting.current) {
            reverting.current = false;
            return;
          }
          commit();
        }}
        onKeyDown={(e) => {
          if (e.nativeEvent.isComposing) return;
          if (e.key === "Enter") {
            e.preventDefault();
            e.currentTarget.blur();
          } else if (e.key === "Escape") {
            e.preventDefault();
            reverting.current = true;
            setDraft(last.current);
            e.currentTarget.blur();
          }
        }}
        className="h-11 min-w-0 flex-1 border-transparent bg-transparent px-2 hover:border-input dark:bg-transparent"
      />
    </label>
  );
}
