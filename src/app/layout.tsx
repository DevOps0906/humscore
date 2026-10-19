import type { Metadata, Viewport } from "next";
import { CloudSync } from "@/components/cloud-sync";
import "./globals.css";

export const metadata: Metadata = {
  title: "HumScore — 허밍으로 만드는 악보",
  description: "흥얼거리면 악보가 됩니다. 원클릭 전조, 코드 악보, 피아노 반주, MIDI·MusicXML 내보내기.",
  manifest: "/manifest.webmanifest",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover", // 노치 영역까지 사용 (safe-area로 여백 처리)
  themeColor: "#161826",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <main className="safe-top mx-auto w-full max-w-5xl flex-1 px-4 pb-28 pt-4 md:px-8">{children}</main>
        <CloudSync />
      </body>
    </html>
  );
}
