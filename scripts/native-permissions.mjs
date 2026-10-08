#!/usr/bin/env node
/**
 * 네이티브 프로젝트에 마이크 권한을 넣는 스크립트 (여러 번 실행해도 안전)
 * `npx cap add android|ios` 로 프로젝트를 새로 만든 뒤 반드시 한 번 실행하세요.
 *   npm run native:permissions
 *
 * - Android: RECORD_AUDIO, MODIFY_AUDIO_SETTINGS
 *   (Capacitor 웹뷰가 getUserMedia 요청 시 런타임 권한 팝업을 자동으로 띄움)
 * - iOS: NSMicrophoneUsageDescription (없으면 마이크 접근 시 앱이 즉시 종료되고 심사도 거절)
 */
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ANDROID = "android/app/src/main/AndroidManifest.xml";
const IOS = "ios/App/App/Info.plist";
const MIC_TEXT = "허밍과 노래를 악보로 바꾸기 위해 마이크를 사용합니다. 녹음된 소리는 기기 밖으로 전송되지 않습니다.";

if (existsSync(ANDROID)) {
  let xml = readFileSync(ANDROID, "utf8");
  for (const perm of ["android.permission.RECORD_AUDIO", "android.permission.MODIFY_AUDIO_SETTINGS"]) {
    if (!xml.includes(perm)) {
      xml = xml.replace("</manifest>", `    <uses-permission android:name="${perm}" />\n</manifest>`);
      console.log(`✔ Android: ${perm}`);
    }
  }
  writeFileSync(ANDROID, xml);
}

if (existsSync(IOS)) {
  let plist = readFileSync(IOS, "utf8");
  if (!plist.includes("NSMicrophoneUsageDescription")) {
    plist = plist.replace(
      /<dict>/,
      `<dict>\n\t<key>NSMicrophoneUsageDescription</key>\n\t<string>${MIC_TEXT}</string>`,
    );
    writeFileSync(IOS, plist);
    console.log("✔ iOS: NSMicrophoneUsageDescription");
  }
}
