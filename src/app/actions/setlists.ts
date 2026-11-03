"use server";

import { z } from "zod";
import {
  setlistIdSchema,
  setlistInputSchema,
  setlistItemsSchema,
  type Setlist,
  type SetlistSummary,
} from "@/lib/storage/setlist-schema";
import { createSupabaseServer } from "@/lib/storage/supabase/server";

// stale: CAS 기준(updated_at)이 서버와 다름 — 다른 곳에서 바뀌었거나 삭제됨, 다시 불러오기 / limit: 콘티 2000개 상한
// notfound: 없거나 삭제됨 / invalid: 입력 형식, 또는 DB check·소유 확인 트리거 거부(삭제·타인 악보 포함)
export type SetlistError = "disabled" | "unauthenticated" | "invalid" | "stale" | "limit" | "notfound" | "failed";
export type SetlistResult<T> = { ok: true; data: T } | { ok: false; error: SetlistError };

// 서버가 준 updated_at 문자열을 그대로 왕복한다(Date 변환 시 마이크로초 손실 → 항상 stale)
const versionSchema = z.iso.datetime({ offset: true });

async function authed() {
  const sb = await createSupabaseServer();
  if (!sb) return { ok: false as const, error: "disabled" as const };
  const { data, error } = await sb.auth.getUser();
  if (error || !data.user) return { ok: false as const, error: "unauthenticated" as const };
  return { ok: true as const, sb, userId: data.user.id };
}

function mapDbError(code: string | undefined): SetlistError {
  if (code === "53400") return "limit";
  if (code === "23514" || code === "22023" || code === "22P02" || code === "42501") return "invalid";
  return "failed";
}

function toRow(input: z.infer<typeof setlistInputSchema>) {
  return {
    title: input.title,
    service_date: input.serviceDate,
    memo: input.memo,
    share_notes: input.shareNotes,
    items: input.items,
  };
}

const summaryRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  service_date: z.iso.date(),
  item_count: z.number().int(),
  updated_at: z.string(),
});

/** 내 콘티 목록(삭제 제외) — 예배일 내림차순 */
export async function listSetlists(): Promise<SetlistResult<SetlistSummary[]>> {
  try {
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("setlists")
      .select("id, title, service_date, item_count, updated_at")
      .eq("user_id", a.userId)
      .is("deleted_at", null)
      .order("service_date", { ascending: false })
      .order("updated_at", { ascending: false })
      .limit(2000);
    if (error) return { ok: false, error: "failed" };
    const rows = z.array(summaryRowSchema).safeParse(data ?? []);
    if (!rows.success) return { ok: false, error: "failed" };
    return {
      ok: true,
      data: rows.data.map((r) => ({ id: r.id, title: r.title, serviceDate: r.service_date, itemCount: r.item_count, updatedAt: r.updated_at })),
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}

const fullRowSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  service_date: z.iso.date(),
  memo: z.string().nullable(),
  share_notes: z.boolean(),
  items: setlistItemsSchema,
  updated_at: z.string(),
});

/** 콘티 1개(삭제 제외). updatedAt 은 다음 저장의 CAS 기준 */
export async function getSetlist(id: unknown): Promise<SetlistResult<Setlist>> {
  try {
    const sid = setlistIdSchema.safeParse(id);
    if (!sid.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("setlists")
      .select("id, title, service_date, memo, share_notes, items, updated_at")
      .eq("id", sid.data)
      .eq("user_id", a.userId)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { ok: false, error: "failed" };
    if (!data) return { ok: false, error: "notfound" };
    const r = fullRowSchema.safeParse(data);
    if (!r.success) return { ok: false, error: "failed" };
    return {
      ok: true,
      data: {
        id: r.data.id,
        title: r.data.title,
        serviceDate: r.data.service_date,
        memo: r.data.memo,
        shareNotes: r.data.share_notes,
        items: r.data.items,
        updatedAt: r.data.updated_at,
      },
    };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 새 콘티. id·updated_at 은 서버가 만든다 */
export async function createSetlist(input: unknown): Promise<SetlistResult<{ id: string; updatedAt: string }>> {
  try {
    const p = setlistInputSchema.safeParse(input);
    if (!p.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("setlists")
      .insert({ ...toRow(p.data), user_id: a.userId })
      .select("id, updated_at")
      .single();
    if (error) return { ok: false, error: mapDbError(error.code) };
    return { ok: true, data: { id: data.id as string, updatedAt: data.updated_at as string } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/**
 * 저장(CAS): 기준 updated_at 이 서버와 같을 때만 반영. 0행이면 stale(덮어쓰기 없음).
 * 새 updatedAt 은 트리거의 서버 now().
 */
export async function saveSetlist(id: unknown, input: unknown, baseUpdatedAt: unknown): Promise<SetlistResult<{ updatedAt: string }>> {
  try {
    const sid = setlistIdSchema.safeParse(id);
    const ver = versionSchema.safeParse(baseUpdatedAt);
    const p = setlistInputSchema.safeParse(input);
    if (!sid.success || !ver.success || !p.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { data, error } = await a.sb
      .from("setlists")
      .update(toRow(p.data))
      .eq("id", sid.data)
      .eq("user_id", a.userId)
      .eq("updated_at", ver.data)
      .is("deleted_at", null)
      .select("updated_at");
    if (error) return { ok: false, error: mapDbError(error.code) };
    if (!data || data.length === 0) return { ok: false, error: "stale" };
    return { ok: true, data: { updatedAt: data[0].updated_at as string } };
  } catch {
    return { ok: false, error: "failed" };
  }
}

/** 삭제(소프트, 멱등). 같은 트랜잭션에서 콘티 공유 링크가 회수된다(DB 트리거) */
export async function deleteSetlist(id: unknown): Promise<SetlistResult<null>> {
  try {
    const sid = setlistIdSchema.safeParse(id);
    if (!sid.success) return { ok: false, error: "invalid" };
    const a = await authed();
    if (!a.ok) return { ok: false, error: a.error };
    const { error } = await a.sb
      .from("setlists")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", sid.data)
      .eq("user_id", a.userId)
      .is("deleted_at", null);
    if (error) return { ok: false, error: "failed" };
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: "failed" };
  }
}
