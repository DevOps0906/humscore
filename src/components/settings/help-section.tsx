import Link from "next/link";
import { SettingsSection } from "./settings-section";

/** package.json version 과 맞춘다 */
export const APP_VERSION = "0.1.0";
const ISSUES_URL = "https://github.com/DevOps0906/humscore/issues";

const linkCls = "inline-flex min-h-11 items-center text-accent underline underline-offset-4 outline-none hover:text-ink focus-visible:ring-3 focus-visible:ring-ring/60 lg:min-h-0";

export function HelpSection() {
  return (
    <SettingsSection id="help" title="도움말·정보">
      <ul className="grid list-disc gap-1 pl-5 text-sm text-ink-soft">
        <li>조용한 곳에서 &lsquo;라~&rsquo; &lsquo;도~&rsquo;처럼 또렷하게 흥얼거리면 음을 더 잘 찾아요.</li>
        <li>메트로놈 박자에 맞춰 부르면 음 길이(음가)가 정확해져요.</li>
        <li>박자가 밀려 보이면 위의 지연 보정 값을 올려 보세요.</li>
        <li>악보 화면에서 반음 올리기·내리기로 원하는 키로 바꿀 수 있어요(원본은 그대로).</li>
      </ul>
      <div className="flex flex-wrap items-center gap-x-5 text-sm">
        <a href={ISSUES_URL} target="_blank" rel="noopener noreferrer" className={linkCls}>
          피드백 보내기 (GitHub 이슈)
        </a>
        <Link href="/privacy" className={linkCls}>개인정보처리방침</Link>
        <Link href="/terms" className={linkCls}>이용약관</Link>
      </div>
      <p className="text-xs text-ink-soft">
        HumScore 버전 <span className="tabular-nums">{APP_VERSION}</span>
      </p>
    </SettingsSection>
  );
}
