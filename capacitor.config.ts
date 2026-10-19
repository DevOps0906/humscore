import type { CapacitorConfig } from "@capacitor/cli";

/**
 * 앱은 운영 웹(Vercel)을 원격 로드합니다 — 서버 기능(SSR·Server Actions·쿠키 인증)을 그대로 사용.
 * native-shell/ 은 네트워크 오류 시 보여줄 오프라인 안내 페이지만 담습니다(server.errorPath).
 *
 * 개발 중 실기기 라이브 리로드: CAP_SERVER_URL=http://<PC IP>:3100 npx cap sync
 */
const devUrl = process.env.CAP_SERVER_URL;

const config: CapacitorConfig = {
  appId: "com.nomadaifactory.humscore",
  appName: "HumScore",
  webDir: "native-shell",
  server: {
    url: devUrl ?? "https://humscore.vercel.app/library",
    cleartext: Boolean(devUrl?.startsWith("http://")),
    errorPath: "index.html",
    // 인증 콜백 등 앱 안에서 열어야 하는 호스트 (Google OAuth는 웹뷰 차단 → 이메일 코드 로그인 권장)
    allowNavigation: ["humscore.vercel.app", "*.supabase.co"],
  },
  ios: {
    contentInset: "automatic",
  },
  android: {
    // 개발 중 크롬 원격 디버깅(chrome://inspect) 허용
    webContentsDebuggingEnabled: true,
  },
};

export default config;
