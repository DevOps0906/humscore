"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * 기기 안 음성 인식(Web Speech API on-device)만 사용하는 받아쓰기.
 * processLocally 를 지원하지 않는 환경은 "unsupported" — 서버 인식으로 절대 폴백하지 않는다.
 * 소리는 브라우저 인식기에만 들어가고, 앱은 결과 텍스트만 받는다(저장·전송 없음).
 * available() 는 일부 환경에서 렌더러를 죽이므로 마운트 시 자동 호출하지 않고, 사용자가 "말로 입력"을 누를 때만 확인한다.
 */

type Availability = "unavailable" | "downloadable" | "downloading" | "available";
interface LocalOptions {
  langs: string[];
  processLocally: boolean;
}
interface RecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface RecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<RecognitionResultLike>;
}
interface RecognitionLike {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  processLocally: boolean;
  onresult: ((e: RecognitionEventLike) => void) | null;
  onerror: ((e: { error: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
  abort: () => void;
}
interface RecognitionCtor {
  new (): RecognitionLike;
  prototype: object;
  available?: (o: LocalOptions) => Promise<Availability>;
  install?: (o: LocalOptions) => Promise<boolean>;
}

/** idle: API 는 있으나 아직 확인 전(사용자 동작 대기) */
export type LocalSpeechStatus = "idle" | "checking" | "unsupported" | "downloadable" | "downloading" | "available";

const LANG = "ko-KR";
const OPTS: LocalOptions = { langs: [LANG], processLocally: true };

function getCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const C = w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
  // 기기 안 인식 확인 API·processLocally 속성이 없으면 지원 안 함으로 본다 (서버 인식 폴백 금지)
  return C && typeof C.available === "function" && "processLocally" in C.prototype ? C : null;
}

async function check(): Promise<LocalSpeechStatus> {
  const C = getCtor();
  if (!C?.available) return "unsupported";
  try {
    const a = await C.available(OPTS);
    return a === "unavailable" ? "unsupported" : a;
  } catch {
    return "unsupported";
  }
}

const ERROR_TEXT: Record<string, string> = {
  "not-allowed": "마이크 권한이 필요해요. 주소창의 사이트 설정에서 마이크를 허용해 주세요.",
  "service-not-allowed": "이 기기에서는 음성 가사 입력을 지원하지 않아요.",
  "language-not-supported": "이 기기에서는 음성 가사 입력을 지원하지 않아요.",
  "audio-capture": "마이크를 찾을 수 없어요.",
  "no-speech": "말소리가 들리지 않았어요. 다시 시도해 주세요.",
};

/** onText: 확정된 문장 조각이 나올 때마다 호출 */
export function useLocalSpeech(active: boolean, onText: (text: string) => void) {
  // 클라이언트에서만 마운트됨(다이얼로그 열릴 때) — API 존재 여부만 보고, available() 은 부르지 않는다
  const [status, setStatus] = useState<LocalSpeechStatus>(() => (getCtor() ? "idle" : "unsupported"));
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const rec = useRef<RecognitionLike | null>(null);
  const alive = useRef(true);
  const onTextRef = useRef(onText);
  useEffect(() => {
    onTextRef.current = onText;
  });

  useEffect(() => {
    if (!active) return;
    alive.current = true;
    return () => {
      alive.current = false;
      rec.current?.abort();
      rec.current = null;
    };
  }, [active]);

  const install = useCallback(async () => {
    const C = getCtor();
    if (!C?.install) return;
    setStatus("downloading");
    try {
      await C.install(OPTS);
    } catch {
      /* 실패하면 아래 재확인으로 상태 결정 */
    }
    const s = await check();
    if (alive.current) setStatus(s);
  }, []);

  const begin = useCallback((C: RecognitionCtor) => {
    if (rec.current) return;
    const r = new C();
    r.processLocally = true; // 기기 안에서만 인식
    r.lang = LANG;
    r.continuous = true;
    r.interimResults = true;
    r.onresult = (e) => {
      let tmp = "";
      for (let i = e.resultIndex; i < e.results.length; i++) {
        const res = e.results[i];
        if (res.isFinal) onTextRef.current(res[0].transcript.trim());
        else tmp += res[0].transcript;
      }
      setInterim(tmp);
    };
    r.onerror = (e) => {
      if (e.error === "aborted") return;
      setError(ERROR_TEXT[e.error] ?? "음성 인식 중 문제가 생겼어요. 다시 시도해 주세요.");
      if (e.error === "service-not-allowed" || e.error === "language-not-supported") setStatus("unsupported");
    };
    r.onend = () => {
      rec.current = null;
      setListening(false);
      setInterim("");
    };
    setError(null);
    rec.current = r;
    try {
      r.start();
      setListening(true);
    } catch {
      rec.current = null;
      setError("음성 인식을 시작하지 못했어요.");
    }
  }, []);

  /** 사용자 동작(버튼)에서만 호출 — 처음이면 기기 안 인식 가능 여부를 확인한 뒤 바로 시작 */
  const start = useCallback(async () => {
    const C = getCtor();
    if (!C || rec.current) return;
    if (status === "idle") {
      setStatus("checking");
      const s = await check();
      if (!alive.current) return;
      setStatus(s);
      if (s === "available") begin(C);
      return;
    }
    if (status === "available") begin(C);
  }, [status, begin]);

  const stop = useCallback(() => rec.current?.stop(), []);

  return { status, listening, interim, error, start, stop, install };
}
