import { Capacitor } from "@capacitor/core";

/**
 * 파일 내보내기 — 웹과 앱의 차이를 여기서 한 번만 흡수합니다.
 *   웹: Blob 다운로드
 *   앱(iOS/Android): 캐시 폴더에 저장 → 시스템 공유 시트(카톡·메일·파일 앱 등)
 */

export const isNativeApp = () => Capacitor.isNativePlatform();

function toBase64(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(bin);
}

export async function exportFile(fileName: string, data: string | Uint8Array, mime: string): Promise<void> {
  const bytes = typeof data === "string" ? new TextEncoder().encode(data) : data;

  if (isNativeApp()) {
    const { Filesystem, Directory } = await import("@capacitor/filesystem");
    const { Share } = await import("@capacitor/share");
    const written = await Filesystem.writeFile({ path: fileName, data: toBase64(bytes), directory: Directory.Cache });
    await Share.share({ title: fileName, url: written.uri, dialogTitle: "악보 공유" });
    return;
  }

  const blob = new Blob([bytes as BlobPart], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export const safeFileName = (title: string) => title.replace(/[\\/:*?"<>|]+/g, "_").slice(0, 60) || "score";
