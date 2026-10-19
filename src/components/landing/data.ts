export const NAV_LINKS = [
  { href: "#products", label: "제품" },
  { href: "#how", label: "사용 방법" },
  { href: "#editor", label: "에디터" },
  { href: "#faq", label: "FAQ" },
] as const;

export const STATS = [
  { num: "500만+", label: "누적 채보 곡 수" },
  { num: "3분", label: "평균 변환 시간" },
  { num: "9종", label: "지원 악기" },
  { num: "140개국", label: "사용 국가" },
] as const;

export const PRODUCTS = [
  { icon: "Layers", title: "HumScore Studio", body: "밴드 녹음에서 악기별 트랙을 분리하고 파트 악보를 한 번에 만듭니다.", href: "/library" },
  { icon: "Piano", title: "Piano", body: "양손 보표, 페달, 셈여림까지 담은 피아노 악보를 만듭니다.", href: "/keys" },
  { icon: "Guitar", title: "Guitar Tab", body: "코드, 스트로크, 프렛 위치를 담은 기타·베이스 탭을 만듭니다.", href: "/library" },
  { icon: "Mic", title: "Vocal", body: "노래에서 멜로디 라인을 뽑아 가사와 함께 리드 시트로 정리합니다.", href: "/record" },
  { icon: "Drum", title: "Drum", body: "킥, 스네어, 하이햇을 구분해 드럼 악보로 기보합니다.", href: "/library" },
  { icon: "ScanLine", title: "Scan", body: "종이 악보 사진을 편집 가능한 디지털 악보로 바꾸고 재생합니다.", href: "/library" },
] as const;

export const STEPS = [
  { num: "01", title: "음악 올리기", body: "녹음 파일, 영상, YouTube 링크 중 무엇이든 괜찮습니다." },
  { num: "02", title: "악기 고르기", body: "채보할 악기를 선택하면 AI가 해당 파트만 분리해 분석합니다." },
  { num: "03", title: "편집하고 내보내기", body: "에디터에서 다듬은 뒤 PDF, MIDI, MusicXML로 저장합니다." },
] as const;

export const CHECKS = ["원곡과 악보 동시 재생, 구간 반복", "속도 조절과 조옮김", "음표 단위 편집과 실행 취소"] as const;

export const FORMATS = [
  { icon: "FileText", name: "PDF", desc: "인쇄용 악보" },
  { icon: "Music", name: "MIDI", desc: "DAW 편곡" },
  { icon: "FileCode", name: "MusicXML", desc: "악보 편집기" },
  { icon: "Guitar", name: "GP5", desc: "Guitar Pro 탭" },
] as const;

export const QUOTES = [
  { text: "레슨 곡을 찾느라 쓰던 주말이 사라졌어요. 학생이 원하는 곡을 그날 바로 악보로 줍니다.", who: "김서연 · 피아노 강사" },
  { text: "귀로 따던 솔로를 탭으로 받아서 운지만 손보면 끝입니다. 정확도가 생각보다 훨씬 높아요.", who: "박준호 · 기타리스트" },
  { text: "합창단 파트 악보를 녹음 하나로 정리했습니다. MusicXML로 바로 넘어가서 편합니다.", who: "이하은 · 합창 지휘자" },
] as const;

export const FAQS = [
  { q: "무료로 사용할 수 있나요?", a: "네. 가입하면 곡마다 앞부분 미리보기를 무료로 확인할 수 있고, 전체 악보와 내보내기는 유료 플랜에서 제공합니다." },
  { q: "얼마나 정확한가요?", a: "녹음 품질과 편성에 따라 달라집니다. 악기 하나가 또렷하게 녹음된 곡일수록 정확하며, 남은 부분은 에디터에서 바로 고칠 수 있습니다." },
  { q: "어떤 파일 형식을 지원하나요?", a: "MP3, WAV, M4A, FLAC 등 대부분의 오디오와 MP4 영상, YouTube 링크를 지원합니다." },
  { q: "모바일에서도 쓸 수 있나요?", a: "웹 브라우저와 iOS·Android 앱에서 같은 계정으로 사용할 수 있습니다." },
] as const;
