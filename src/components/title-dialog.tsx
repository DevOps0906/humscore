"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";

interface TitleDialogProps {
  open: boolean;
  /** 입력칸 초기값이자 비워 두거나 건너뛸 때 쓰는 제목 */
  defaultTitle: string;
  /** 확정된 제목(trim 적용, 빈 값이면 defaultTitle). 저장이 끝날 때까지 기다림 */
  onConfirm: (title: string) => void | Promise<void>;
  /** Esc / 닫기 버튼 / 바깥 클릭 — 저장하지 않음 */
  onCancel: () => void;
}

function TitleForm({ defaultTitle, onConfirm }: Pick<TitleDialogProps, "defaultTitle" | "onConfirm">) {
  const [value, setValue] = useState(defaultTitle);
  const [busy, setBusy] = useState(false);

  async function submit(title: string) {
    if (busy) return;
    setBusy(true);
    try {
      await onConfirm(title.trim() || defaultTitle);
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit(value);
      }}
    >
      <label className="grid gap-1.5 text-sm">
        <span className="text-ink-soft">제목</span>
        <Input
          autoFocus
          type="text"
          value={value}
          maxLength={100}
          disabled={busy}
          onFocus={(e) => e.currentTarget.select()}
          onChange={(e) => setValue(e.target.value)}
          className="h-11 text-base"
        />
      </label>
      <DialogFooter>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void submit(defaultTitle)} className="h-11 px-4 text-sm">
          건너뛰기
        </Button>
        <Button type="submit" disabled={busy} className="h-11 px-4 text-sm">
          저장
        </Button>
      </DialogFooter>
    </form>
  );
}

export function TitleDialog({ open, defaultTitle, onConfirm, onCancel }: TitleDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>노래 제목</DialogTitle>
          <DialogDescription>악보에 붙일 제목을 입력해 주세요.</DialogDescription>
        </DialogHeader>
        {/* 열릴 때마다 새로 마운트되어 입력값이 기본 제목으로 초기화됨 */}
        <TitleForm defaultTitle={defaultTitle} onConfirm={onConfirm} />
      </DialogContent>
    </Dialog>
  );
}
