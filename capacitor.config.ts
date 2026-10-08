import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.nomadaifactory.humscore",
  appName: "HumScore",
  webDir: "out", // next build(output: "export") 결과물
  ios: {
    contentInset: "automatic",
    // allowsInlineMediaPlayback: Capacitor 8 타입에 미포함이지만 네이티브에서 설정 필요 시
    // ios/App/App/AppDelegate.swift 또는 CAPBridgeViewController를 통해 설정하세요.
    // Capacitor 5+ 기본값이 true이므로 대부분의 경우 별도 설정 불필요합니다.
  },
  android: {
    // 개발 중 크롬 원격 디버깅(chrome://inspect) 허용
    webContentsDebuggingEnabled: true,
  },
  // 개발 시 실기기에서 라이브 리로드를 쓰려면 아래 주석을 풀고 PC의 IP를 넣으세요.
  // 배포 빌드에서는 반드시 주석 처리 (원격 URL 앱은 애플 심사 거절 위험)
  // server: { url: "http://192.168.0.10:3000", cleartext: true },
};

export default config;
