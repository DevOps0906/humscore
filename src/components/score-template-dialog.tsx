"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScoreView } from "./score-view";
import { ScoreHeader, HeaderSettings, type HeaderPatch } from "./score-header";
import { scoreTypography } from "@/lib/music/header-fonts";
import { METER_IDS } from "@/lib/music/meter";
import { TabScoreView } from "./tab-score-view";
import { buildScoreTemplate, SCORE_TEMPLATES, type ScoreTemplateId } from "@/lib/music/score-templates";
import { INSTRUMENT_LABELS, ACOUSTIC_PIANOS, ELECTRIC_PIANOS, SYNTH_INSTRUMENTS, GUITAR_INSTRUMENTS, ORCHESTRA_GROUPS, type InstrumentId } from "@/lib/music/instrument-catalog";
import { scoreToMusicXML } from "@/lib/music/musicxml";
import { isGuitarInstrument } from "@/lib/music/tablature";
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
  const [lyricist, setLyricist] = useState("");
  const [composer, setComposer] = useState("");
  const [arranger, setArranger] = useState("");
  const [textStyle, setTextStyle] = useState<Partial<HeaderPatch>>({});
  const preview = useMemo(() => buildScoreTemplate({ template, instruments, title, bpm, meter, measures, tonic, lyricist, composer, arranger }), [template, instruments, title, bpm, meter, measures, tonic, lyricist, composer, arranger]);
  const sample = useMemo(() => buildScoreTemplate({ template, instruments, title: template === "hymn" ? "주 하나님 지으신 모든 세계" : title, bpm, meter: "4/4", measures: template === "orchestra" ? 4 : 8, tonic, lyricist, composer, arranger, previewSample: true }), [template, instruments, title, bpm, tonic, lyricist, composer, arranger]);
  const visibleScore = useMemo(() => ({ ...(step === 1 ? sample : preview), ...textStyle }), [step, sample, preview, textStyle]);
  const tabInstrument = instruments.length === 1 && isGuitarInstrument(instruments[0]) ? instruments[0] : null;
  const xml = useMemo(() => scoreToMusicXML(visibleScore, "piano", { measuresPerSystem: 4, externalHeader: true }), [visibleScore]);
  const scorePreview = <div data-testid="template-score-preview" className="mx-auto w-full min-w-0 rounded-xl border border-line bg-score-paper px-3 pt-3 pb-5 text-black">
    <ScoreHeader score={visibleScore} />
    {tabInstrument ? <TabScoreView score={visibleScore} instrument={tabInstrument} /> : <ScoreView flat printLayout={false} fitHeight={false} typography={scoreTypography(visibleScore)} xml={xml} />}
  </div>;
  return <Dialog open onOpenChange={(open) => { if (!open) onClose(); }}>
    <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-6xl">
      <DialogHeader><DialogTitle>템플릿으로 시작하기</DialogTitle><DialogDescription>악보 형식과 악기 편성을 선택하고 조성·박자·빠르기를 설정하세요. 예시를 확인한 뒤 빈 악보로 시작합니다.</DialogDescription></DialogHeader>
      <ol className="grid grid-cols-3 gap-2 text-center text-xs" aria-label="템플릿 생성 단계">{["악보 형식", "악기 선택", "생성하기"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined} className={`rounded-lg border p-2 ${step === index + 1 ? "border-accent bg-accent/15 text-accent" : "border-line text-ink-soft"}`}>{index + 1}. {label}</li>)}</ol>
      {step === 1 && <div className="grid min-w-0 grid-cols-1 items-start gap-3 md:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] md:gap-4">
        <section aria-label="악보 형식 선택" className="grid min-w-0 grid-cols-2 gap-2 md:grid-cols-1">
        {SCORE_TEMPLATES.map((entry) => <Button key={entry.id} type="button" variant="outline" aria-pressed={entry.id === template} onClick={() => {
          setTemplate(entry.id); setInstruments([...entry.instruments]); setTitle(entry.id === "hymn" ? "주 하나님 지으신 모든 세계" : entry.title); setBpm(entry.bpm); setMeter(entry.meter); setMeasures(8);
        }} className={`h-auto min-h-11 min-w-0 flex-col items-start gap-2 whitespace-normal p-2 text-left md:p-4 ${entry.id === template ? "border-accent bg-accent/15 text-accent" : ""}`}>
          <span className="text-xs font-semibold md:text-sm">{entry.title}</span><span className="hidden text-xs text-ink-soft md:block">{entry.detail}</span>
        </Button>)}
        </section>
        <section aria-label="템플릿 미리보기" className="grid min-w-0 justify-items-center gap-2 text-center">
          <h2 className="text-sm font-bold">{preset.title} · 예시 미리보기</h2>
          <p className="text-xs text-ink-soft">{preset.detail} · 4/4 · {template === "orchestra" ? 4 : 8}마디. 예시 음표는 생성되는 악보에 포함되지 않습니다.</p>
          {template === "hymn" && <p className="text-xs text-ink-soft">전통 선율을 재구성한 소프라노·알토·테너·베이스 4성부와 1~4절 예시 가사입니다.</p>}
          <div className="flex w-full min-w-0 items-start justify-center">{scorePreview}</div>
        </section>
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
          <label className="grid gap-1 text-sm">박자<select aria-label="템플릿 박자" value={meter} onChange={(event) => setMeter(event.target.value as Meter)} className={field}>{METER_IDS.map((value) => <option key={value}>{value}</option>)}</select></label>
          <label className="grid gap-1 text-sm">마디 수<select aria-label="템플릿 마디 수" value={measures} onChange={(event) => setMeasures(Number(event.target.value))} className={field}>{[4, 8, 16, 32].map((value) => <option key={value} value={value}>{value}마디</option>)}</select></label>
          <label className="grid gap-1 text-sm">조성<select aria-label="템플릿 조성" value={tonic} onChange={(event) => setTonic(Number(event.target.value))} className={field}>{["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"].map((value, index) => <option key={value} value={index}>{value}장조</option>)}</select></label>
        </div>
        <fieldset className="grid min-w-0 gap-3">
          <legend className="mb-2 text-sm font-semibold">제작자</legend>
          <label className="grid gap-1 text-sm">작사자<Input aria-label="템플릿 작사자" value={lyricist} maxLength={100} onChange={(event) => setLyricist(event.target.value)} className="h-11" /></label>
          <label className="grid gap-1 text-sm">작곡자<Input aria-label="템플릿 작곡자" value={composer} maxLength={100} onChange={(event) => setComposer(event.target.value)} className="h-11" /></label>
          <label className="grid gap-1 text-sm">편곡자<Input aria-label="템플릿 편곡자" value={arranger} maxLength={100} onChange={(event) => setArranger(event.target.value)} className="h-11" /></label>
        </fieldset>
        <p className="text-xs text-ink-soft">참고한 구성: {preset.reference}</p>
        <HeaderSettings score={visibleScore} onChange={setTextStyle} />
        <p role="status" className="text-sm text-ink-soft">선택한 악기 편성과 마디 수를 갖춘 빈 악보로 생성합니다. 아래에서 시작할 악보를 확인하세요.</p>
        {scorePreview}
        {replacing && <p role="status" className="text-sm text-ink-soft">생성하면 현재 입력 중인 초안이 이 템플릿으로 바뀝니다. 내 악보에 저장한 곡은 유지됩니다.</p>}
      </div>}
      <div className="flex flex-wrap justify-between gap-2">
        <Button type="button" variant="outline" onClick={() => step === 1 ? onClose() : setStep(step - 1)} className="h-11 px-5">{step === 1 ? "취소" : "이전"}</Button>
        {step < 3 ? <Button type="button" disabled={!instruments.length} onClick={() => setStep(step + 1)} className="h-11 px-5">다음</Button> : <Button type="button" disabled={!instruments.length || !title.trim()} onClick={() => onCreate({ ...preview, ...textStyle })} className="h-11 px-5">{replacing ? "현재 초안을 템플릿으로 교체" : "이 템플릿으로 악보 생성"}</Button>}
      </div>
    </DialogContent>
  </Dialog>;
}
