"use server";

import { createSupabaseServer } from "@/lib/storage/supabase/server";

/** 로그아웃(이 기기의 쿠키 세션만 제거 — 다른 기기 세션은 유지). 로컬 악보 정리는 클라이언트가 합니다. */
export async function signOut(): Promise<{ ok: boolean }> {
  try {
    const sb = await createSupabaseServer();
    if (!sb) return { ok: true };
    const { error } = await sb.auth.signOut({ scope: "local" });
    return { ok: !error };
  } catch {
    return { ok: false };
  }
}
