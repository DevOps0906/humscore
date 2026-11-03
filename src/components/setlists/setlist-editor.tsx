"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveSetlist, type SetlistResult, type SetlistScorePreview } from "@/app/actions/setlists";
import { Button } from "@/components/ui/button";
import { keyName, transposeKey } from "@/lib/music/theory";
import type { Setlist } from "@/lib/storage/setlist-schema";

const CONTROL = "h-11 w-full rounded-lg border border-input bg-surface px-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/60";
const TEXTAREA = "min-h-20 w-full rounded-lg border border-input bg-surface p-3 text-base outline-none focus-visible:ring-3 focus-visible:ring-ring/60";

function errorText(error: string): string {
  switch (error) {
    case "unauthenticated": return "로그인 후 콘티를 저장할 수 있어요.";
    case "stale": return "다른 곳에서 콘티가 바뀌었어요. 최신 내용을 다시 불러와 주세요.";
    case "limit": return "콘티에 곡이 너무 많거나 저장 용량을 초과했어요.";
    case "invalid": return "입력 내용이나 악보 상태를 확인해 주세요.";
    case "notfound": return "콘티를 찾을 수 없어요.";
    default: return "저장하지 못했어요. 잠시 후 다시 시도해 주세요.";
  }
}

export function SetlistEditor({
  setlist,
  scoreResult,
}: {
  setlist: Setlist;
  scoreResult: SetlistResult<SetlistScorePreview[]>;
}) {
  const router = useRouter();
  const [title, setTitle] = useState(setlist.title);
  const [serviceDate, setServiceDate] = useState(setlist.serviceDate);
  const [memo, setMemo] = useState(setlist.memo ?? "");
  const [shareNotes, setShareNotes] = useState(setlist.shareNotes);
  const [items, setItems] = useState(setlist.items);
  const [selectedScoreId, setSelectedScoreId] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [reloadRequired, setReloadRequired] = useState(false);
  const scoreById = useMemo(() => new Map(scoreResult.ok ? scoreResult.data.map((score) => [score.id, score]) : []), [scoreResult]);
  const hasUnavailable = items.some((item) => !scoreById.has(item.scoreId) || scoreById.get(item.scoreId)?.deleted);
  const canSave = title.trim().length > 0 && serviceDate.length > 0 && !hasUnavailable && scoreResult.ok;

  function addScore() {
    const score = scoreById.get(selectedScoreId);
    if (!score || score.deleted || items.length >= 50) return;
    setItems((current) => [...current, {
      scoreId: score.id,
      transpose: score.transpose,
      bpm: null,
      form: null,
      note: null,
      transition: null,
    }]);
    setSelectedScoreId("");
    setError("");
  }

  function patchItem(index: number, patch: Partial<(typeof items)[number]>) {
    setItems((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function moveItem(index: number, offset: -1 | 1) {
    const next = index + offset;
    if (next < 0 || next >= items.length) return;
    setItems((current) => {
      const result = [...current];
      [result[index], result[next]] = [result[next], result[index]];
      return result;
    });
  }

  async function save() {
    if (!canSave || busy) return;
    setBusy(true);
    setError("");
    try {
      const result = await saveSetlist(setlist.id, {
        title: title.trim(),
        serviceDate,
        memo: memo || null,
        shareNotes,
        items,
      }, setlist.updatedAt);
      if (!result.ok) {
        setError(errorText(result.error));
        setReloadRequired(result.error === "stale");
        return;
      }
      router.push(`/setlists/${setlist.id}`);
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link href="/setlists" className="inline-flex h-11 items-center text-sm text-ink-soft underline underline-offset-4">콘티 목록</Link>
        <Button asChild variant="outline" className="h-11 px-4">
          <Link href={`/setlists/${setlist.id}`}>취소</Link>
        </Button>
      </div>
      <div className="grid gap-4 rounded-2xl bg-surface p-4 md:grid-cols-2 md:p-6">
        <label htmlFor="setlist-title" className="grid gap-1 text-sm">
          예배명 <span className="text-destructive" aria-hidden>*</span>
          <input id="setlist-title" className={CONTROL} maxLength={100} value={title} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label htmlFor="setlist-service-date" className="grid gap-1 text-sm">
          예배일 <span className="text-destructive" aria-hidden>*</span>
          <input id="setlist-service-date" className={CONTROL} type="date" required value={serviceDate} onChange={(event) => setServiceDate(event.target.value)} />
        </label>
        <label className="grid gap-1 text-sm md:col-span-2">
          인도자 멘트
          <textarea className={TEXTAREA} maxLength={1000} value={memo} onChange={(event) => setMemo(event.target.value)} />
          <span className="text-right text-xs text-ink-soft">{memo.length}/1000</span>
        </label>
        <label className="flex min-h-11 items-center gap-3 text-sm md:col-span-2">
          <input type="checkbox" className="size-5 accent-[var(--accent)]" checked={shareNotes} onChange={(event) => setShareNotes(event.target.checked)} />
          공유 링크에 인도자 멘트·곡 메모·전환 메모 공개
        </label>
      </div>

      <section aria-labelledby="setlist-songs" className="grid gap-3">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 id="setlist-songs" className="text-xl font-semibold">곡 순서 <span className="text-sm font-normal text-ink-soft">{items.length}/50</span></h2>
            <p className="mt-1 text-sm text-ink-soft">로그인해 클라우드에 동기화된 내 악보만 추가할 수 있어요.</p>
          </div>
          <div className="flex min-w-0 flex-1 gap-2 md:max-w-xl">
            <select className={`${CONTROL} min-w-0`} aria-label="추가할 악보 선택" value={selectedScoreId} onChange={(event) => setSelectedScoreId(event.target.value)}>
              <option value="">악보 선택</option>
              {scoreResult.ok && scoreResult.data.filter((score) => !score.deleted).map((score) => (
                <option key={score.id} value={score.id}>{score.title || "제목 없는 악보"}</option>
              ))}
            </select>
            <Button type="button" variant="outline" className="h-11 px-3" disabled={!selectedScoreId || items.length >= 50} onClick={addScore}>
              <Plus aria-hidden /> 추가
            </Button>
          </div>
        </div>
        {!scoreResult.ok && (
          <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">클라우드 악보를 불러오지 못했어요. 페이지를 새로고침해 주세요.</p>
        )}
        {items.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line p-5 text-sm text-ink-soft">곡을 추가해 예배 순서를 정해 보세요.</p>
        ) : (
          <ol className="grid gap-3">
            {items.map((item, index) => {
              const score = scoreById.get(item.scoreId);
              const unavailable = !score || score.deleted;
              return (
                <li key={`${item.scoreId}-${index}`} className="grid gap-4 rounded-2xl bg-surface p-4 ring-1 ring-line">
                  <div className="flex items-start gap-3">
                    <span className="grid size-8 shrink-0 place-items-center rounded-full bg-section text-sm font-semibold tabular-nums">{index + 1}</span>
                    <div className="min-w-0 flex-1">
                      <p className={`font-semibold ${unavailable ? "text-destructive" : ""}`}>
                        {score?.title ?? "삭제되었거나 접근할 수 없는 악보"}
                        {score?.deleted && " · 삭제됨"}
                      </p>
                      {score && !score.deleted && (
                        <p className="mt-1 text-sm text-ink-soft">원본 {keyName(score.key)} · {score.bpm} BPM</p>
                      )}
                    </div>
                    <div className="flex shrink-0 gap-1">
                      <Button type="button" variant="outline" className="size-11 p-0 lg:size-9" aria-label={`${index + 1}번째 곡 위로`} disabled={index === 0} onClick={() => moveItem(index, -1)}><ArrowUp aria-hidden /></Button>
                      <Button type="button" variant="outline" className="size-11 p-0 lg:size-9" aria-label={`${index + 1}번째 곡 아래로`} disabled={index === items.length - 1} onClick={() => moveItem(index, 1)}><ArrowDown aria-hidden /></Button>
                      <Button type="button" variant="destructive" className="size-11 p-0 lg:size-9" aria-label={`${index + 1}번째 곡 제거`} onClick={() => setItems((current) => current.filter((_, i) => i !== index))}><Trash2 aria-hidden /></Button>
                    </div>
                  </div>
                  {score && !score.deleted && (
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      <label className="grid gap-1 text-xs text-ink-soft">
                        연주 키
                        <select className={CONTROL} value={item.transpose} onChange={(event) => patchItem(index, { transpose: Number(event.target.value) })}>
                          {Array.from({ length: 49 }, (_, i) => i - 24).map((transpose) => (
                            <option key={transpose} value={transpose}>{keyName(transposeKey(score.key, transpose))}</option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-1 text-xs text-ink-soft">
                        템포 (BPM, 비우면 원본)
                        <input className={CONTROL} type="number" min={1} max={400} value={item.bpm ?? ""} onChange={(event) => patchItem(index, { bpm: event.target.value ? Number(event.target.value) : null })} />
                      </label>
                      <label className="grid gap-1 text-xs text-ink-soft">
                        진행 순서
                        <input className={CONTROL} maxLength={200} value={item.form ?? ""} onChange={(event) => patchItem(index, { form: event.target.value || null })} placeholder="전주-A-B-후렴" />
                      </label>
                      <label className="grid gap-1 text-xs text-ink-soft md:col-span-2 lg:col-span-3">
                        곡 메모
                        <textarea className={TEXTAREA} maxLength={500} value={item.note ?? ""} onChange={(event) => patchItem(index, { note: event.target.value || null })} />
                      </label>
                      <label className="grid gap-1 text-xs text-ink-soft md:col-span-2 lg:col-span-3">
                        다음 곡 전환 메모
                        <textarea className={TEXTAREA} maxLength={300} value={item.transition ?? ""} onChange={(event) => patchItem(index, { transition: event.target.value || null })} />
                      </label>
                    </div>
                  )}
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {error && <p role="alert" className="rounded-xl bg-destructive/10 p-4 text-sm text-destructive">{error}</p>}
      <div className="no-print flex flex-wrap items-center gap-3">
        <Button type="button" className="h-11 px-5" disabled={!canSave || busy} onClick={() => void save()}>{busy ? "저장 중…" : "저장"}</Button>
        {reloadRequired && <Button type="button" variant="outline" className="h-11 px-4" onClick={() => window.location.reload()}>최신 내용 다시 불러오기</Button>}
        {!canSave && !error && <p className="text-sm text-ink-soft">{hasUnavailable ? "삭제되었거나 접근할 수 없는 악보를 제거해야 저장할 수 있어요." : "예배명과 예배일을 입력해 주세요."}</p>}
      </div>
    </div>
  );
}
