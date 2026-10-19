import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import { CloudSync } from "@/components/cloud-sync";
import { cn } from "@/lib/utils";
import "./globals.css";

// 라틴: Inter(next/font 자체 호스팅). 한글: Pretendard Variable(동적 서브셋 CDN, globals.css 폰트 스택).
const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const PRETENDARD_CSS =
  "https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css";

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
    <html lang="ko" className={cn("h-full antialiased", inter.variable)}>
      <head>
        <link rel="preconnect" href="https://cdn.jsdelivr.net" crossOrigin="" />
        <link rel="stylesheet" href={PRETENDARD_CSS} crossOrigin="" />
      </head>
      <body className="flex min-h-full flex-col">
        {children}
        <CloudSync />
      </body>
    </html>
  );
}
