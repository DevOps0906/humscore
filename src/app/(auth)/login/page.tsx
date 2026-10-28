"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/use-auth";
import { isAuthMock, setMockSignedIn } from "@/lib/storage/auth-mock";
import { getSupabase } from "@/lib/storage/supabase/client";
import { safeNextPath } from "./next-path";

const noop = () => () => {};
const OTP_LENGTH = 6;

export default function LoginPage() {
  return isAuthMock() ? <MockLogin /> : <SupabaseLogin />;
}

/** 로그인 후 갈 곳: 같은 origin 경로(?next)만 허용, 아니면 /library */
function nextPath(): string {
  return safeNextPath(new URLSearchParams(window.location.search).get("next"), window.location.origin);
}

/** 체험(mock) 로그인 — 서버 호출 없이 이 기기에서만 로그인 상태를 켠다 */
function MockLogin() {
  const router = useRouter();
  const auth = useAuth();

  useEffect(() => {
    if (auth.status === "signed-in") router.replace(nextPath());
  }, [auth.status, router]);

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 pt-6 md:max-w-md md:pt-14 lg:pt-20">
      <header>
        <h1 className="text-3xl font-medium tracking-tight">로그인</h1>
        <p className="mt-1 text-sm text-ink-soft">지금은 체험 로그인만 제공해요. 악보는 이 기기에만 저장돼요.</p>
      </header>
      <Card className="gap-3 p-4">
        <Button type="button" onClick={() => setMockSignedIn(true)} className="h-11 w-full text-sm">
          체험 로그인으로 시작
        </Button>
      </Card>
    </div>
  );
}

function SupabaseLogin() {
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
    else router.replace("/library");
  };

  const google = async () => {
    const sb = getSupabase();
    if (!sb) return;
    const { error } = await sb.auth.signInWithOAuth({ provider: "google", options: { redirectTo: callbackUrl() } });
    if (error) setMessage("Google 로그인을 시작하지 못했어요.");
  };

  return (
    <div className="mx-auto flex w-full max-w-sm flex-col gap-5 pt-6 md:max-w-md md:pt-14 lg:pt-20">
      <header>
        <h1 className="text-3xl font-medium tracking-tight">로그인</h1>
        <p className="mt-1 text-sm text-ink-soft">로그인하면 악보가 모든 기기에 동기화돼요. 로그인 없이도 쓸 수 있어요.</p>
      </header>

      {auth.status === "disabled" ? (
        <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-sm text-ink-soft">
          이 환경에서는 로그인이 설정되지 않았어요. 악보는 이 기기에만 저장돼요.
        </p>
      ) : auth.status === "signed-in" ? (
        <Card className="gap-3 p-4">
          <p className="text-sm">{auth.email} 로 로그인되어 있어요.</p>
          <Button asChild className="h-11 w-full">
            <Link href="/library">내 악보로 가기</Link>
          </Button>
        </Card>
      ) : (
        <Card className="gap-4 p-4">
          {failedCallback && <p role="alert" className="text-sm text-tune-bad">로그인에 실패했어요. 다시 시도해 주세요.</p>}

          <Button type="button" variant="outline" onClick={google} className="h-11 w-full text-sm">
            Google로 계속하기
          </Button>

          <div className="flex items-center gap-3 text-xs text-ink-soft">
            <span className="h-px flex-1 bg-line" /> 또는 이메일 <span className="h-px flex-1 bg-line" />
          </div>

          {!sent ? (
            <form onSubmit={sendLink} className="flex flex-col gap-3">
              <Label htmlFor="login-email" className="sr-only">이메일 주소</Label>
              <Input
                id="login-email"
                type="email"
                required
                autoComplete="email"
                placeholder="이메일 주소"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="h-11 text-base"
              />
              <Button type="submit" disabled={busy} className="h-11 w-full text-sm">{busy ? "보내는 중…" : "로그인 링크 받기"}</Button>
            </form>
          ) : (
            <form onSubmit={verifyCode} className="flex flex-col gap-3">
              <p className="text-sm">{email} 로 메일을 보냈어요. 메일의 링크를 누르거나, 코드를 입력하세요.</p>
              <InputOTP
                maxLength={OTP_LENGTH}
                value={code}
                onChange={setCode}
                inputMode="numeric"
                autoComplete="one-time-code"
                aria-label="인증 코드 6자리"
                containerClassName="justify-center"
              >
                <InputOTPGroup>
                  {Array.from({ length: OTP_LENGTH }, (_, i) => (
                    <InputOTPSlot key={i} index={i} className="size-11 text-lg" />
                  ))}
                </InputOTPGroup>
              </InputOTP>
              <Button type="submit" disabled={busy || code.length < OTP_LENGTH} className="h-11 w-full text-sm">{busy ? "확인 중…" : "코드로 로그인"}</Button>
              <Button type="button" variant="ghost" onClick={() => { setSent(false); setCode(""); }} className="h-11 text-xs text-ink-soft">이메일 다시 입력</Button>
            </form>
          )}
          {message && <p role="alert" className="text-sm text-tune-bad">{message}</p>}
        </Card>
      )}

      <p className="text-center text-xs leading-5 text-ink-soft">
        로그인하면{" "}
        <Link href="/terms" className="underline hover:text-accent">
          이용약관
        </Link>{" "}
        및{" "}
        <Link href="/privacy" className="underline hover:text-accent">
          개인정보처리방침
        </Link>
        에 동의하는 것으로 봅니다.
      </p>
    </div>
  );
}
