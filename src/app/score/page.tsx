"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ScoreView } from "@/components/score-view";
import { TransposeBar } from "@/components/transpose-bar";
import { useScoreParam } from "@/hooks/use-score-param";
import { getAudioContext, setAudioSessionType } from "@/lib/audio/context";
import { playScore, type Playback } from "@/lib/audio/piano-synth";
import { GM_INSTRUMENTS, scoreToMidi, type InstrumentId } from "@/lib/music/midi";
import { scoreToMusicXML, type ScoreLayout } from "@/lib/music/musicxml";
import { keyName, transposeChordSymbol, transposeKey } from "@/lib/music/theory";
import { exportFile, safeFileName } from "@/lib/platform/export-file";
import { deleteScore } from "@/lib/storage/scores";

const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  piano: "피아노",
  strings: "스트링 합주",
  flute: "플루트",
  violin: "바이올린",
  cello: "첼로",
  trumpet: "트럼펫",
  clarinet: "클라리넷",
  acousticGuitar: "어쿠스틱 기타",
  choir: "합창",
};

export default function ScorePage() {
  const router = useRouter();
  const { score, update } = useScoreParam();
  const [layout, setLayout] = useState<ScoreLayout>("lead");
  const [instrument, setInstrument] = useState<InstrumentId>("piano");
  const [playing, setPlaying] = useState(false);
  const playback = useRef<Playback | null>(null);
  const stopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const pendingCleanup = useRef<(() => void) | null>(null);

  /** 재생·타이머·대기 중 리스너를 모두 정리 */
  const clearPlayback = useCallback(() => {
    pendingCleanup.current?.();
    pendingCleanup.current = null;
    playback.current?.stop();
    playback.current = null;
    if (stopTimer.current) clearTimeout(stopTimer.current);
    stopTimer.current = null;
  }, []);

  useEffect(() => clearPlayback, [clearPlayback]);

  const xml = useMemo(() => (score ? scoreToMusicXML(score, layout) : ""), [score, layout]);

  if (score === undefined) return <p className="text-ink-soft">불러오는 중…</p>;
  if (score === null)
    return (
      <div className="py-20 text-center">
        <p className="text-ink-soft">악보를 찾을 수 없어요.</p>
        <Link href="/" className="mt-4 inline-block text-accent underline">내 악보로</Link>
      </div>
    );

  const shownKey = transposeKey(score.key, score.transpose);
  const preferFlats = shownKey.fifths < 0;

  function togglePlay() {
    if (playing) {
      clearPlayback();
      setPlaying(false);
      return;
    }
    clearPlayback(); // 기존 재생·타이머·리스너 정리 후 시작
    setAudioSessionType("playback");
    const ctx = getAudioContext(); // 제스처 핸들러 안에서 동기 호출 (await 금지)
    const target = score!;
    const doPlay = () => {
      playback.current = playScore(ctx, target);
      stopTimer.current = setTimeout(() => setPlaying(false), (playback.current.durationSec + 2.5) * 1000);
    };
    setPlaying(true);
    if (ctx.state === "running") {
      doPlay();
    } else {
      let giveUp: ReturnType<typeof setTimeout> | null = null;
      const release = () => {
        ctx.removeEventListener("statechange", h);
        if (giveUp) clearTimeout(giveUp);
        pendingCleanup.current = null;
      };
      function h() {
        if (ctx.state === "running") {
          release();
          doPlay();
        }
      }
      ctx.addEventListener("statechange", h);
      giveUp = setTimeout(() => {
        release();
        setPlaying(false);
      }, 3000);
      pendingCleanup.current = release;
    }
  }

  function editChord(index: number) {
    const current = transposeChordSymbol(score!.chords[index].symbol, score!.transpose, preferFlats);
    const input = window.prompt(`${index + 1}마디 코드 (예: C, Am, G7, F/A)`, current)?.trim();
    if (!input || !/^[A-G][#b]?[^\s]*$/.test(input)) return;
    // 화면에는 전조된 코드를 보여주므로, 저장은 원키 기준으로 되돌려서
    const original = transposeChordSymbol(input, -score!.transpose, score!.key.fifths < 0);
    update({ chords: score!.chords.map((c, i) => (i === index ? { ...c, symbol: original } : c)) });
  }

  const base = `${safeFileName(score.title)}_${keyName(shownKey)}`;

  return (
    <div className="flex flex-col gap-4">
      <div className="no-print flex items-start justify-between gap-3">
        <input
          defaultValue={score.title}
          onBlur={(e) => e.target.value.trim() && update({ title: e.target.value.trim() })}
          className="w-full bg-transparent text-xl font-bold outline-none focus:underline"
          aria-label="악보 제목"
        />
        <Link href={`/perform/?id=${score.id}`} className="shrink-0 rounded-full border border-line px-4 py-2 text-sm">
          공연 모드
        </Link>
      </div>

      <div className="no-print flex flex-wrap items-center gap-2 text-sm">
        {(["lead", "piano"] as const).map((l) => (
          <button
            key={l}
            type="button"
            onClick={() => setLayout(l)}
            className={`rounded-full border px-4 py-1.5 ${layout === l ? "border-ink bg-ink text-paper" : "border-line"}`}
          >
            {l === "lead" ? "코드 악보" : "피아노"}
          </button>
        ))}
        <span className="ml-auto text-ink-soft">
          {score.bpm} BPM · {score.beatsPerMeasure}/4
        </span>
      </div>

      <ScoreView xml={xml} />

      {/* 코드 수정 */}
      <section className="no-print">
        <p className="mb-2 text-xs text-ink-soft">코드를 눌러 수정 (AI 추천값 · 마디당 1개)</p>
        <div className="flex flex-wrap gap-2">
          {score.chords.map((c, i) => (
            <button key={i} type="button" onClick={() => editChord(i)} className="rounded-lg border border-line bg-surface px-3 py-1.5 text-sm">
              <span className="mr-1 text-xs text-ink-soft">{i + 1}</span>
              {transposeChordSymbol(c.symbol, score.transpose, preferFlats)}
            </button>
          ))}
        </div>
      </section>

      {/* 내보내기 */}
      <section className="no-print grid gap-3 rounded-2xl border border-line bg-surface p-4">
        <p className="text-sm font-semibold">내보내기 · {keyName(shownKey)}키 기준</p>
        <div className="flex flex-wrap gap-2 text-sm">
          <button type="button" onClick={() => window.print()} className="rounded-full border border-line px-4 py-2">
            PDF / 인쇄
          </button>
          <button
            type="button"
            onClick={() => exportFile(`${base}.musicxml`, xml, "application/vnd.recordare.musicxml+xml")}
            className="rounded-full border border-line px-4 py-2"
          >
            MusicXML
          </button>
          <div className="flex items-center gap-1 rounded-full border border-line pl-3">
            <select value={instrument} onChange={(e) => setInstrument(e.target.value as InstrumentId)} className="bg-transparent py-2" aria-label="MIDI 멜로디 악기">
              {(Object.keys(GM_INSTRUMENTS) as InstrumentId[]).map((id) => (
                <option key={id} value={id}>{INSTRUMENT_LABELS[id]}</option>
              ))}
            </select>
            <button
              type="button"
              onClick={() => exportFile(`${base}_${instrument}.mid`, scoreToMidi(score, { melodyInstrument: instrument }), "audio/midi")}
              className="rounded-full bg-ink px-4 py-2 text-paper"
            >
              MIDI
            </button>
          </div>
        </div>
        <button
          type="button"
          onClick={() => {
            if (!confirm("이 악보를 삭제할까요?")) return;
            deleteScore(score.id);
            router.push("/");
          }}
          className="justify-self-start text-xs text-tune-bad"
        >
          악보 삭제
        </button>
      </section>

      {/* 하단 고정: 재생 + 전조 */}
      <div className="no-print fixed inset-x-0 bottom-[72px] z-10 px-4">
        <div className="mx-auto flex max-w-md items-center gap-2">
          <button
            type="button"
            onClick={togglePlay}
            className={`h-14 w-14 shrink-0 rounded-full text-accent-ink shadow ${playing ? "bg-ink" : "bg-accent"}`}
            aria-label={playing ? "정지" : "재생"}
          >
            {playing ? "■" : "▶"}
          </button>
          <div className="flex-1">
            <TransposeBar originalKey={score.key} transpose={score.transpose} onChange={(t) => update({ transpose: t })} />
          </div>
        </div>
      </div>
      <div className="h-28" />
    </div>
  );
}
