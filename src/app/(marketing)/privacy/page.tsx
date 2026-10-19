import type { Metadata } from "next";
import Link from "next/link";
import { LegalPage, LegalTable, Ol, Ul, type LegalSection } from "@/components/legal/legal-page";

export const metadata: Metadata = {
  title: "개인정보처리방침 — HumScore",
  description: "HumScore가 어떤 개인정보를 어떻게 수집·이용·보관하는지 안내합니다.",
};

const sections: LegalSection[] = [
  {
    id: "article-1",
    title: "제1조 (총칙)",
    body: (
      <>
        <p>
          Nomad AI Factory(이하 &ldquo;회사&rdquo;)는 HumScore 서비스(https://humscore.vercel.app 및 iOS·Android 앱, 앱은 준비 중)를
          제공하며, 이용자의 개인정보를 소중히 다룹니다. 이 방침은 회사가 어떤 정보를 어떤 목적으로 처리하는지 알려 드립니다.
        </p>
        <p>
          운영자: Nomad AI Factory / 사업자 정보: <code>[사업자 정보]</code>
        </p>
        <p>
          HumScore는 회원가입 없이 사용할 수 있습니다. 로그인하지 않으면 회사 서버에 저장되는 개인정보가 없으며, 악보는 이용자 기기의
          브라우저 저장소에만 저장됩니다.
        </p>
      </>
    ),
  },
  {
    id: "article-2",
    title: "제2조 (수집하는 개인정보 항목)",
    body: (
      <LegalTable
        head={["구분", "수집 항목"]}
        rows={[
          ["로그인 시", "이메일 주소, 계정 식별자(UUID), 로그인 세션 쿠키"],
          ["Google 로그인 시", "Google이 제공하는 이메일, 이름, 프로필 이미지 URL"],
          ["악보 동기화 시", "악보 데이터(제목, 음표, 코드, 조성, 템포, 생성·수정·삭제 시각)"],
          ["자동 수집", "서비스 제공 과정의 접속 로그(IP 주소, 브라우저 정보, 접속 시각). 호스팅 사업자의 로그로 기록됩니다."],
        ]}
      />
    ),
  },
  {
    id: "article-3",
    title: "제3조 (개인정보의 이용 목적)",
    body: (
      <Ul>
        <li>회원 식별 및 로그인</li>
        <li>기기 간 악보 동기화</li>
        <li>서비스 운영, 오류 대응, 부정 이용 방지</li>
      </Ul>
    ),
  },
  {
    id: "article-4",
    title: "제4조 (마이크 음성의 처리)",
    body: (
      <p>
        마이크로 들어온 소리는 이용자 기기 안에서 실시간으로 음높이 숫자로 변환됩니다. 회사는 녹음 파일을 만들지 않으며, 음성을 저장하거나
        서버로 전송하지 않습니다. 음표로 바뀐 숫자 정보만 악보 데이터로 남습니다. 분석·광고 추적 도구는 사용하지 않습니다.
      </p>
    ),
  },
  {
    id: "article-5",
    title: "제5조 (보유 및 이용 기간)",
    body: (
      <Ol>
        <li>회원이 탈퇴(계정 삭제 요청)하면 개인정보를 지체 없이 파기합니다.</li>
        <li>이용자가 삭제한 악보는 기기 간 동기화를 위해 삭제 기록(식별자와 삭제 시각)만 남으며, 이 기록도 탈퇴 시 함께 파기합니다.</li>
        <li>법령에 따라 보관해야 하는 정보는 해당 법령이 정한 기간 동안 보관합니다.</li>
      </Ol>
    ),
  },
  {
    id: "article-6",
    title: "제6조 (처리 위탁 및 국외 이전)",
    body: (
      <>
        <p>회사는 서비스 제공을 위해 아래와 같이 개인정보 처리를 위탁하며, 일부는 국외로 이전됩니다.</p>
        <LegalTable
          head={["수탁자(이전받는 자)", "위탁·이전 업무", "저장·실행 위치 / 소재국"]}
          rows={[
            ["Supabase Inc.", "인증 및 데이터베이스(계정, 악보 데이터 저장)", "데이터 저장 위치: 대한민국 서울 리전 / 법인 소재국: 미국"],
            [
              "Vercel Inc.",
              "웹 호스팅 및 서버 실행(접속 로그 포함)",
              "서버 실행 위치: 대한민국 서울 리전을 기본으로 하며, 전 세계 CDN을 통해 전송 / 법인 소재국: 미국",
            ],
            ["Google LLC", "Google 로그인을 선택한 경우 인증", "법인 소재국: 미국"],
            ["jsDelivr CDN", "웹 글꼴 제공. 글꼴을 불러오는 과정에서 IP 주소가 CDN에 전달될 수 있습니다.", "전 세계 CDN"],
          ]}
        />
        <p>
          이전 항목은 제2조의 항목 중 해당 업무에 필요한 정보이며, 이전 시기와 방법은 서비스 이용 시 네트워크를 통한 수시 전송입니다.
          로그인하지 않고도 서비스를 이용할 수 있습니다.
        </p>
      </>
    ),
  },
  {
    id: "article-7",
    title: "제7조 (쿠키 및 브라우저 저장소)",
    body: (
      <Ul>
        <li>로그인 세션을 유지하기 위한 필수 쿠키만 사용합니다.</li>
        <li>악보와 설정은 브라우저 저장소(localStorage)에 저장됩니다.</li>
        <li>브라우저 설정에서 쿠키와 저장소를 삭제할 수 있으며, 삭제하면 비로그인 상태에서 기기에만 저장된 악보도 함께 삭제됩니다.</li>
      </Ul>
    ),
  },
  {
    id: "article-8",
    title: "제8조 (이용자의 권리와 행사 방법)",
    body: (
      <Ol>
        <li>
          이용자는 언제든지 자신의 개인정보에 대한 열람, 정정, 삭제, 처리정지를 요구할 수 있으며, 계정 삭제도 요청할 수 있습니다. 요청은{" "}
          <code>[연락처 이메일]</code>로 보내 주세요.
        </li>
        <li>로그아웃하면 기기에 저장된 해당 계정의 악보는 삭제됩니다.</li>
        <li>로그인하지 않고 쓴 데이터는 브라우저 저장소를 삭제하여 직접 지울 수 있습니다.</li>
      </Ol>
    ),
  },
  {
    id: "article-9",
    title: "제9조 (만 14세 미만 아동)",
    body: <p>만 14세 미만의 아동은 법정대리인의 동의 없이 로그인(회원가입)하지 않도록 안내합니다.</p>,
  },
  {
    id: "article-10",
    title: "제10조 (안전성 확보 조치)",
    body: (
      <Ul>
        <li>전송 구간 암호화(HTTPS)</li>
        <li>행 단위 접근 통제: 이용자는 본인의 데이터에만 접근할 수 있습니다.</li>
        <li>접근 권한 최소화</li>
      </Ul>
    ),
  },
  {
    id: "article-11",
    title: "제11조 (개인정보 보호책임자)",
    body: (
      <Ul>
        <li>
          성명: <code>[담당자]</code>
        </li>
        <li>
          연락처: <code>[연락처 이메일]</code>
        </li>
      </Ul>
    ),
  },
  {
    id: "article-12",
    title: "제12조 (방침의 변경)",
    body: (
      <p>
        이 방침의 내용이 바뀌면 서비스 내에서 변경 내용과 시행일을 알립니다. 서비스 이용에 관한 약관은{" "}
        <Link href="/terms" className="text-accent underline">
          이용약관
        </Link>
        에서 확인할 수 있습니다.
      </p>
    ),
  },
  {
    id: "addendum",
    title: "부칙",
    body: <p>이 방침은 2026년 10월 20일부터 시행합니다.</p>,
  },
];

export default function PrivacyPage() {
  return <LegalPage title="개인정보처리방침" effectiveDate="2026년 10월 20일" sections={sections} />;
}
