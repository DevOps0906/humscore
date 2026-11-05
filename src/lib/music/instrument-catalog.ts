/** 악보 생성 방식과 실제 재생 음색을 분리한다. GM 번호는 0부터 센다. */
export type CreationMode = "piano" | "guitarTab" | "drums" | "orchestra";

export const CREATION_MODES: readonly { id: CreationMode; label: string }[] = [
  { id: "piano", label: "피아노" }, { id: "guitarTab", label: "기타TAB" },
  { id: "drums", label: "드럼" }, { id: "orchestra", label: "오케스트라" },
];

export const GM_INSTRUMENTS = {
  piano: 0, feltPiano: 0, uprightPiano: 0,
  epRhodes: 4, epBright: 4, epBell: 5, epSuitcase: 4, epStage: 4,
  epTine: 4, epWurli: 4, epCP: 2, epFM: 5, epChorus: 5,
  warmPad: 89, ambientPad: 88, shimmerPad: 92, analogPad: 90, orchestralPad: 89,
  b3Organ: 16, churchOrgan: 19, synthPluck: 81, synthBell: 98,
  synthLead: 80, synthArp: 81, synthBass: 38, voxPad: 91, texturePad: 96,
  classicalGuitar: 24, acousticGuitar: 25, electricGuitar: 27, bassGuitar: 33, bassGuitar5: 33,
  strings: 48, violin: 40, violinII: 40, viola: 41, cello: 42, doubleBass: 43,
  flute: 73, piccolo: 72, oboe: 68, englishHorn: 69, clarinet: 71, bassoon: 70,
  frenchHorn: 60, trumpet: 56, trombone: 57, bassTrombone: 57, tuba: 58,
  timpani: 47, timpaniRoll: 47, harp: 46, celesta: 8,
  glockenspiel: 9, xylophone: 13, marimba: 12, vibraphone: 11,
  choir: 52, drumKit: 0,
  orchestralSnare: 0, orchestralBassDrum: 0, orchestralCymbal: 0, triangle: 0,
} as const;
export type InstrumentId = keyof typeof GM_INSTRUMENTS;

export const INSTRUMENT_LABELS: Record<InstrumentId, string> = {
  piano: "그랜드 피아노", feltPiano: "펠트 피아노", uprightPiano: "업라이트 피아노",
  epRhodes: "로즈 EP", epBright: "브라이트 EP", epBell: "벨 EP", epSuitcase: "수트케이스 EP", epStage: "스테이지 EP",
  epTine: "타인 EP", epWurli: "워리처 EP", epCP: "CP 일렉피아노", epFM: "FM 일렉피아노", epChorus: "코러스 EP",
  warmPad: "웜 패드", ambientPad: "앰비언트 패드", shimmerPad: "쉬머 패드", analogPad: "아날로그 패드", orchestralPad: "오케스트라 패드",
  b3Organ: "B3 오르간", churchOrgan: "파이프오르간", synthPluck: "신스 플럭", synthBell: "신스 벨",
  synthLead: "신스 리드", synthArp: "신스 아르페지오", synthBass: "신스 베이스", voxPad: "보컬 패드", texturePad: "텍스처 패드",
  classicalGuitar: "클래식 기타", acousticGuitar: "통기타", electricGuitar: "일렉기타", bassGuitar: "베이스기타(4현)", bassGuitar5: "베이스기타(5현)",
  strings: "스트링 합주", violin: "바이올린 I", violinII: "바이올린 II", viola: "비올라", cello: "첼로", doubleBass: "더블베이스",
  flute: "플루트", piccolo: "피콜로", oboe: "오보에", englishHorn: "잉글리시 호른", clarinet: "클라리넷", bassoon: "바순",
  frenchHorn: "호른", trumpet: "트럼펫", trombone: "트롬본", bassTrombone: "베이스 트롬본", tuba: "튜바",
  timpani: "팀파니", timpaniRoll: "팀파니 롤", harp: "하프", celesta: "첼레스타",
  glockenspiel: "글로켄슈필", xylophone: "실로폰", marimba: "마림바", vibraphone: "비브라폰", choir: "합창", drumKit: "드럼 키트",
  orchestralSnare: "스네어 드럼", orchestralBassDrum: "베이스드럼", orchestralCymbal: "심벌", triangle: "트라이앵글",
};

export const ACOUSTIC_PIANOS = ["piano", "feltPiano", "uprightPiano"] as const;
export const ELECTRIC_PIANOS = ["epRhodes", "epBright", "epBell", "epSuitcase", "epStage", "epTine", "epWurli", "epCP", "epFM", "epChorus"] as const;
export const SYNTH_INSTRUMENTS = ["warmPad", "ambientPad", "shimmerPad", "analogPad", "orchestralPad", "b3Organ", "churchOrgan", "synthPluck", "synthBell", "synthLead", "synthArp", "synthBass", "voxPad", "texturePad"] as const;
export const GUITAR_INSTRUMENTS = ["acousticGuitar", "electricGuitar", "classicalGuitar", "bassGuitar", "bassGuitar5"] as const;
/** 무음정 타악기의 실제 GM 드럼 음번호. program 번호와 구분한다. */
export const ORCHESTRAL_DRUM_NOTES: Partial<Record<InstrumentId, number>> = {
  orchestralSnare: 38, orchestralBassDrum: 36, orchestralCymbal: 49, triangle: 81,
};
export const ORCHESTRA_GROUPS = [
  { id: "strings", label: "현악", instruments: ["violin", "violinII", "viola", "cello", "doubleBass", "strings"] },
  { id: "woodwinds", label: "목관", instruments: ["flute", "piccolo", "oboe", "englishHorn", "clarinet", "bassoon"] },
  { id: "brass", label: "금관", instruments: ["frenchHorn", "trumpet", "trombone", "bassTrombone", "tuba"] },
  { id: "timpani", label: "팀파니", instruments: ["timpani", "timpaniRoll"] },
  { id: "percussion", label: "타악기", instruments: ["orchestralSnare", "orchestralBassDrum", "orchestralCymbal", "triangle", "glockenspiel", "xylophone", "marimba", "vibraphone", "celesta"] },
  { id: "harp", label: "하프", instruments: ["harp"] },
  { id: "voices", label: "보컬·합창", instruments: ["choir"] },
] as const satisfies readonly { id: string; label: string; instruments: readonly InstrumentId[] }[];

export const INSTRUMENT_ORDER = Object.keys(GM_INSTRUMENTS) as InstrumentId[];
export function isInstrumentId(value: unknown): value is InstrumentId {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(GM_INSTRUMENTS, value);
}
export function isCreationMode(value: unknown): value is CreationMode {
  return typeof value === "string" && CREATION_MODES.some((mode) => mode.id === value);
}
export function instrumentMode(instrument: InstrumentId): CreationMode {
  if (instrument === "drumKit") return "drums";
  if ((GUITAR_INSTRUMENTS as readonly string[]).includes(instrument)) return "guitarTab";
  if (([...ACOUSTIC_PIANOS, ...ELECTRIC_PIANOS, ...SYNTH_INSTRUMENTS] as readonly string[]).includes(instrument)) return "piano";
  return "orchestra";
}
