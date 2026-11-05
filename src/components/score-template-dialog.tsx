"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreView } from "./score-view";
import { buildScoreTemplate, SCORE_TEMPLATES, type ScoreTemplateId } from "@/lib/music/score-templates";
import { INSTRUMENT_LABELS, ACOUSTIC_PIANOS, ELECTRIC_PIANOS, SYNTH_INSTRUMENTS, GUITAR_INSTRUMENTS, ORCHESTRA_GROUPS, type InstrumentId } from "@/lib/music/instrument-catalog";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import type { Meter, Score } from "@/lib/music/types";

const groups: { label: string; instruments: readonly InstrumentId[] }[] = [
  { label: "피아노", instruments: ACOUSTIC_PIANOS }, { label: "일렉피아노", instruments: ELECTRIC_PIANOS },
  { label: "신디사이저", instruments: SYNTH_INSTRUMENTS }, { label: "기타·베이스", instruments: GUITAR_INSTRUMENTS },
  { label: "드럼", instruments: ["drumKit"] }, ...ORCHESTRA_GROUPS,
];
const field = "h-11 w-full rounded-md border border-input bg-surface px-3 text-sm";

export function ScoreTemplateDialog({ onClose, onCreate, replacing }: { onClose: () => void; onCreate: (score: Score) => void; replacing: boolean }) {
  const [step, setStep] = useState(1);
  const [template, setTemplate] = useState<ScoreTemplateId>("ccm");
  const preset = SCORE_TEMPLATES.find((entry) => entry.id === template)!;
  const [instruments, setInstruments] = useState<InstrumentId[]>([...SCORE_TEMPLATES[0].instruments]);
  const [title, setTitle] = useState<string>(SCORE_TEMPLATES[0].title);
  const [bpm, setBpm] = useState<number>(84);
  const [meter, setMeter] = useState<Meter>("4/4");
  const [measures, setMeasures] = useState(8);
  const [tonic, setTonic] = useState(0);
  const preview = useMemo(() => buildScoreTemplate({ template, instruments, title, bpm, meter, measures, tonic }), [template, instruments, title, bpm, meter, measures, tonic]);
  const xml = useMemo(() => step === 3 ? scoreToMusicXML(preview, "piano", { measuresPerSystem: 4 }) : "", [step, preview]);
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-4xl">
      <DialogHeader><DialogTitle>템플릿으로 시작하기</DialogTitle><DialogDescription>악보 설정 마법사: 형식 선택 → 악기 편성 → 조성·박자·빠르기와 미리보기. 참고 자료의 구성을 재현한 악보를 직접 편집할 수 있어요.</DialogDescription></DialogHeader>
      <ol className="grid grid-cols-3 gap-2 text-center text-xs" aria-label="템플릿 생성 단계">{["악보 형식", "악기 선택", "생성하기"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`rounded-lg border p-2 ${step === index + 1 ? "border-accent bg-accent/15 text-accent" : "border-line text-ink-soft"}`}>{index + 1}. {label}</li>)}</ol>
      {step === 1 && <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        {SCORE_TEMPLATES.map((entry) => <Button key={entry.id} type="button" variant="outline" aria-pressed={entry.id === template} onClick={() => {
          setTemplate(entry.id); setInstruments([...entry.instruments]); setTitle(entry.title); setBpm(entry.bpm); setMeter(entry.meter);
        }} className={`h-auto min-w-0 flex-col items-start gap-2 whitespace-normal p-4 text-left ${entry.id === template ? "border-accent bg-accent/15 text-accent" : ""}`}>
          <span className="font-semibold">{entry.title}</span><span className="text-xs text-ink-soft">{entry.detail}</span>
          <svg viewBox="0 0 240 45" className="h-9 w-full" aria-hidden="true">{[8, 15, 22, 29, 36].map((y) => <line key={y} x1="2" x2="238" y1={y} y2={y} stroke="currentColor" opacity="0.3" />)}{[40, 80, 120, 160, 200].map((x, i) => <g key={x}><ellipse cx={x} cy={29 - i % 3 * 7} rx="5" ry="3.5" fill="currentColor" /><path d={`M${x + 4} ${29 - i % 3 * 7}v-20`} stroke="currentColor" /></g>)}</svg>
        </Button>)}
      </div>}
      {step === 2 && <div className="grid min-w-0 gap-3">
        <p role="status" className="text-sm">{instruments.length}개 악기 선택 · 각 악기에 독립된 악보가 생깁니다.</p>
        {groups.map((group) => <details key={group.label} open={group.instruments.some((id) => instruments.includes(id))} className="rounded-xl border border-line p-3">
          <summary className="cursor-pointer text-sm font-semibold">{group.label}</summary>
          <div className="mt-2 grid grid-cols-2 gap-2 md:grid-cols-3">{group.instruments.map((id) => <label key={id} className="flex min-h-11 items-center gap-2 text-sm"><input type="checkbox" checked={instruments.includes(id)} onChange={(event) => setInstruments((previous) => event.target.checked ? previous.length < 32 ? [...previous, id] : previous : previous.filter((instrument) => instrument !== id))} className="size-4 accent-accent" /><span>{INSTRUMENT_LABELS[id]}</span></label>)}</div>
        </details>)}
      </div>}
      {step === 3 && <div className="grid min-w-0 gap-4">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <label className="col-span-2 grid gap-1 text-sm">악보 제목<Input aria-label="템플릿 악보 제목" value={title} maxLength={100} onChange={(event) => setTitle(event.target.value)} className="h-11" /></label>
          <label className="grid gap-1 text-sm">빠르기 BPM<Input aria-label="템플릿 BPM" type="number" min={30} max={240} value={bpm} onChange={(event) => setBpm(Math.max(30, Math.min(240, Number(event.target.value) || 84)))} className="h-11" /></label>
          <label className="grid gap-1 text-sm">박자<select aria-label="템플릿 박자" value={meter} onChange={(event) => setMeter(event.target.value as Meter)} className={field}>{(["3/4", "4/4", "6/8"] as const).map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="grid gap-1 text-sm">마디 수<select aria-label="템플릿 마디 수" value={measures} onChange={(event) => setMeasures(Number(event.target.value))} className={field}>{[4, 8, 16, 32].map((value) => <option key={value} value={value}>{value}마디</option>)}</select></label>
          <label className="grid gap-1 text-sm">조성<select aria-label="템플릿 조성" value={tonic} onChange={(event) => setTonic(Number(event.target.value))} className={field}>{["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"].map((value, index) => <option key={value} value={index}>{value}장조</option>)}</select></label>
        </div>
        <p className="text-xs text-ink-soft">참고한 구성: {preset.reference}</p>
        <ScoreView xml={xml} />
        {replacing && <p role="status" className="text-sm text-ink-soft">생성하면 현재 입력 중인 초안이 이 템플릿으로 바뀝니다. 내 악보에 저장한 곡은 유지됩니다.</p>}
      </div>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => step === 1 ? onClose() : setStep(step - 1)} className="h-11 px-5">{step === 1 ? "취소" : "이전"}</Button>
        {step < 3 ? <Button type="button" disabled={!instruments.length} onClick={() => setStep(step + 1)} className="h-11 px-5">다음</Button> : <Button type="button" disabled={!instruments.length || !title.trim()} onClick={() => onCreate(preview)} className="h-11 px-5">{replacing ? "현재 초안을 템플릿으로 교체" : "이 템플릿으로 악보 생성"}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
