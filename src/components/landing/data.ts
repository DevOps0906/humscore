export const NAV_LINKS = [
  { href: "#products", label: "기능" },
  { href: "#how", label: "사용 방법" },
  { href: "#editor", label: "에디터" },
  { href: "#faq", label: "FAQ" },
] as const;

export const STATS = [
  { num: "무료", label: "가입 없이 시작", href: "#pricing" },
  { num: "88건반", label: "화면 피아노 입력", href: "/keys" },
  { num: "3가지", label: "MIDI · MusicXML · PDF", href: "#formats" },
  { num: "0", label: "저장되는 음성 데이터", href: "#privacy" },
] as const;

/** 히어로 신뢰 띠: STATS 4 + 1 (v2) */
export const TRUST = [...STATS, { num: "설치 없이", label: "브라우저에서 바로", href: "#how" }] as const;

/** 체험 띠 카드 */
export const TRY_CARDS = [
  { icon: "Mic", title: "흥얼거려서 악보 만들기", body: "마이크로 허밍하면 음표로 받아 적습니다", href: "/record", cta: true },
  { icon: "Keyboard", title: "건반으로 입력하기", body: "화면 피아노로 직접 음을 찍어 보세요", href: "/keys", cta: false },
  { icon: "Library", title: "내 악보 보기", body: "저장해 둔 악보를 열어 이어서 다듬기", href: "/library", cta: false },
] as const;

export const PRODUCTS = [
  { icon: "Mic", title: "허밍 채보", body: "흥얼거린 멜로디의 음정과 박자를 따라가 음표로 받아 적고 조성을 찾아 줍니다.", href: "#demo" },
  { icon: "Piano", title: "건반 입력", body: "88건반 화면 피아노나 PC 키보드로 음을 직접 찍고 바로 들어 봅니다.", href: "/keys" },
  { icon: "ListMusic", title: "코드 추천", body: "멜로디에 어울리는 코드를 마디마다 제안하고, 원하는 코드로 바꿀 수 있습니다.", href: "#editor-chords" },
  { icon: "ArrowUpDown", title: "원클릭 전조", body: "버튼 하나로 키를 올리고 내립니다. 원본은 그대로라 언제든 원키로 돌아옵니다.", href: "#editor-transpose" },
  { icon: "MonitorPlay", title: "공연 모드", body: "태블릿을 보면대로. 화면 탭이나 페이지 터너 페달로 악보를 넘깁니다.", href: "#editor-perform" },
  { icon: "Download", title: "내보내기", body: "MIDI와 MusicXML로 내보내 MuseScore, Finale, DAW에서 이어서 작업합니다.", href: "#formats" },
] as const;

export const STEPS = [
  { num: "01", icon: "Mic", title: "흥얼거리기", body: "녹음 버튼을 누르고 메트로놈에 맞춰 멜로디를 불러 보세요." },
  { num: "02", icon: "ListMusic", title: "다듬기", body: "틀린 음과 코드를 고치고, 피아노로 들어 보며 키를 맞춥니다." },
  { num: "03", icon: "Download", title: "연주하고 내보내기", body: "공연 모드로 연주하거나 MIDI·MusicXML·PDF로 저장합니다." },
] as const;

/** 신규 기능(v2). CTA 화면은 아직 없어 "곧 제공"으로 비활성. 모두 단선율. */
export const NEW_FEATURES = [
  {
    id: "new-upload",
    icon: "Upload",
    title: "오디오 파일 업로드 채보",
    card: "녹음해 둔 단선율 오디오 파일을 올리면 브라우저 안에서 음표로 받아 적습니다.",
    heading: "오디오 파일을 올려 악보로",
    body: "마이크 대신 가지고 있는 단선율 오디오 파일을 올려 보세요. 같은 방식으로 음표와 코드가 붙은 악보가 됩니다.",
    cta: "파일로 시작하기",
  },
  {
    id: "new-roll",
    icon: "ChartNoAxesGantt",
    title: "피아노 롤",
    card: "음표를 막대로 보고 길이와 높이를 끌어서 고칩니다.",
    heading: "피아노 롤로 끌어서 고치기",
    body: "음표를 가로 막대로 보면서 길이와 높이를 직접 끌어 맞춥니다. 오선 악보와 함께 바뀝니다.",
    cta: "피아노 롤 열기",
  },
  {
    id: "new-tab",
    icon: "Guitar",
    title: "기타 TAB",
    card: "단선율 악보를 기타 줄·프렛 번호로 바꿔 보여 줍니다.",
    heading: "기타 TAB으로 바꿔 보기",
    body: "단선율 악보를 기타 6줄 위의 프렛 번호로 보여 줍니다. 연습하기 편한 줄 위치를 고를 수 있습니다.",
    cta: "TAB 보기",
  },
] as const;

/** 장점 6: 현행 기능·FAQ 사실만 */
export const WHY = [
  { icon: "Zap", title: "가입 없이 바로", body: "계정 없이 열어서 바로 흥얼거릴 수 있습니다." },
  { icon: "ShieldCheck", title: "목소리는 저장하지 않아요", body: "음성은 기기 안에서 음표로만 바뀝니다." },
  { icon: "Keyboard", title: "건반으로도 입력", body: "88건반 화면 피아노나 PC 키보드로 찍어 넣습니다." },
  { icon: "ArrowUpDown", title: "원본을 지키는 전조", body: "키를 바꿔도 원본은 그대로, 언제든 원키로 돌아옵니다." },
  { icon: "MonitorPlay", title: "보면대가 되는 공연 모드", body: "탭이나 페달로 페이지를 넘기며 연주합니다." },
  { icon: "ListMusic", title: "조성 찾기와 코드 추천", body: "멜로디의 조성을 찾고 어울리는 코드를 제안합니다." },
] as const;

export const TOOLS = ["MuseScore", "Finale", "Sibelius", "DAW"] as const;

export const CHECKS = ["음표·박자 편집", "코드 수정과 추천", "피아노 재생과 조옮김"] as const;

export const FORMATS = [
  { icon: "FileText", name: "PDF", desc: "인쇄용 악보" },
  { icon: "Music", name: "MIDI", desc: "DAW 편곡" },
  { icon: "FileCode", name: "MusicXML", desc: "악보 편집기" },
] as const;

export const FAQS = [
  { id: "free", q: "무료인가요?", a: "네. 지금은 모든 기능을 무료로 쓸 수 있고 가입하지 않아도 됩니다. 로그인하면 여러 기기에서 같은 악보를 볼 수 있어요." },
  { id: "accuracy", q: "얼마나 정확한가요?", a: "한 음씩 또렷하게, 조용한 곳에서 부를수록 정확합니다. 한 번에 한 멜로디(단선율)만 인식하며, 틀린 음은 에디터에서 바로 고칠 수 있습니다." },
  { id: "files", q: "음악 파일이나 유튜브도 되나요?", a: "아직은 마이크로 직접 부르거나 건반으로 입력하는 방식만 지원합니다." },
  { id: "mobile", q: "모바일에서도 쓸 수 있나요?", a: "휴대폰과 태블릿 브라우저에서 바로 쓸 수 있습니다. iOS·Android 앱은 준비 중입니다." },
  { id: "voice", q: "내 목소리가 저장되나요?", a: "아니요. 음성은 기기 안에서 음표로만 바뀌고 어디에도 저장되거나 전송되지 않습니다." },
] as const;

export const EDITOR_TABS = [
  { id: "edit", label: "편집" },
  { id: "chords", label: "코드" },
  { id: "transpose", label: "전조" },
  { id: "perform", label: "공연" },
] as const;
export type EditorTabId = (typeof EDITOR_TABS)[number]["id"];

/** 비교 데모 샘플 멜로디: 시안 악보와 같은 9음(C장조). staffY는 5선 좌표(20=위선, 60=아랫선). */
export const SAMPLE_NOTES = [
  { midi: 67, y: 50 }, { midi: 69, y: 45 }, { midi: 71, y: 40 },
  { midi: 72, y: 35 }, { midi: 71, y: 40 }, { midi: 69, y: 45 },
  { midi: 67, y: 50 }, { midi: 72, y: 35 }, { midi: 74, y: 30 },
] as const;
export const SAMPLE_CHORDS = ["C", "F", "G7"] as const;
