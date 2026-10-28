"use client";

import { useState } from "react";
import { Copy, MoreHorizontal, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ConfirmDialog } from "@/components/confirm-dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import type { Score } from "@/lib/music/types";
import { deleteScore, getScore, saveScore } from "@/lib/storage/scores";

/** 카드 더보기: 복제(saveScore로 새 id 저장) · 삭제(deleteScore) */
export function ScoreMoreMenu({ score }: { score: Score }) {
  const [askDelete, setAskDelete] = useState(false);

  const duplicate = async () => {
    const now = new Date().toISOString();
    const id = crypto.randomUUID();
    try {
      await saveScore({ ...score, id, title: `${score.title} 복사본`, createdAt: now, updatedAt: now });
    } catch {
      // 아래 재확인에서 실패로 처리
    }
    if (getScore(id)) toast.success("악보를 복제했어요");
    else toast.error("악보를 복제하지 못했어요");
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`${score.title} 더보기`}
          className="absolute top-1 right-1 grid size-11 place-items-center rounded-lg text-ink-soft outline-none hover:bg-section focus-visible:ring-3 focus-visible:ring-ring/60"
        >
          <MoreHorizontal aria-hidden />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem className="min-h-11" onSelect={() => void duplicate()}>
            <Copy aria-hidden /> 복제
          </DropdownMenuItem>
          <DropdownMenuItem className="min-h-11 text-destructive" onSelect={() => setAskDelete(true)}>
            <Trash2 aria-hidden /> 삭제
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <ConfirmDialog
        open={askDelete}
        onOpenChange={setAskDelete}
        title="이 악보를 삭제할까요?"
        description={`"${score.title}"을(를) 삭제하면 되돌릴 수 없어요.`}
        onConfirm={() => {
          setAskDelete(false);
          deleteScore(score.id);
        }}
      />
    </>
  );
}
