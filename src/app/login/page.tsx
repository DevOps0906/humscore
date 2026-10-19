"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type FormEvent } from "react";
import { useAuth } from "@/hooks/use-auth";
import { getSupabase } from "@/lib/storage/supabase/client";

const noop = () => () => {};

export default function LoginPage() {
  const router = useRouter();
  const auth = useAuth();
  const failedCallback = useSyncExternalStore(
    noop,
    () => new URLSearchParams(window.location.search).has("error"),
    () => false,
  );
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const callbackUrl = () => `${window.location.origin}/auth/callback`;

  const sendLink = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !email.trim()) return;
    setBusy(true);
    setMessage(null);
    const { error } = await sb.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: callbackUrl() } });
    setBusy(false);
    if (error) setMessage("메일을 보내지 못했어요. 잠시 후 다시 시도해 주세요.");
    else setSent(true);
  };

  const verifyCode = async (e: FormEvent) => {
    e.preventDefault();
    const sb = getSupabase();
    if (!sb || !code.trim()) return;
    setBusy(true);
    setMessage(null);
    const { error } = await sb.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: "email" });
    setBusy(false);
    if (error) setMessage("코드가 맞지 않거나 만료됐어요.");
    else router.replace("/library/");
  };

  const google = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error) setMessage("Google 로그인을 시작하지 못했어요.");
  };

  const input = "w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm outline-none focus:border-accent";
  const primary = "w-full rounded-2xl bg-accent px-4 py-3 text-sm font-semibold text-accent-ink disabled:opacity-50";

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 pt-6">
      <header>
        <h1 className="text-3xl font-medium tracking-tight">로그인</h1>
        <p className="mt-1 text-sm text-ink-soft">로그인하면 악보가 모든 기기에 동기화돼요. 로그인 없이도 쓸 수 있어요.</p>
      </header>

      {auth.status === "disabled" ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          이 환경에서는 로그인이 설정되지 않았어요. 악보는 이 기기에만 저장돼요.
        </p>
      ) : auth.status === "signed-in" ? (
        <div className="flex flex-col gap-3 rounded-2xl bg-surface p-4 shadow-sm">
          <p className="text-sm">{auth.email} 로 로그인되어 있어요.</p>
          <Link href="/library/" className={`${primary} text-center`}>내 악보로 가기</Link>
        </div>
      ) : (
        <>
          {failedCallback && <p role="alert" className="text-sm text-tune-bad">로그인에 실패했어요. 다시 시도해 주세요.</p>}

          <button type="button" onClick={google} className="w-full rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold">
            Google로 계속하기
          </button>

          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" /> 또는 이메일 <span className="h-px flex-1 bg-line" />
          </div>

          {!sent ? (
            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <input type="email" required autoComplete="email" placeholder="이메일 주소" value={email} onChange={(e) => setEmail(e.target.value)} className={input} />
              <button type="submit" disabled={busy} className={primary}>{busy ? "보내는 중…" : "로그인 링크 받기"}</button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="flex flex-col gap-3">
              <p className="text-sm">{email} 로 메일을 보냈어요. 메일의 링크를 누르거나, 코드를 입력하세요.</p>
              <input inputMode="numeric" autoComplete="one-time-code" placeholder="인증 코드" value={code} onChange={(e) => setCode(e.target.value)} className={input} />
              <button type="submit" disabled={busy} className={primary}>{busy ? "확인 중…" : "코드로 로그인"}</button>
              <button type="button" onClick={() => setSent(false)} className="text-xs text-ink-soft underline underline-offset-4">이메일 다시 입력</button>
            </form>
          )}
          {message && <p role="alert" className="text-sm text-tune-bad">{message}</p>}
        </>
      )}
    </div>
  );
}
