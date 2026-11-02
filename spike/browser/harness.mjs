// 정적 서버 + 시스템 Chrome(Playwright) + 워커 메시지 헬퍼. WebKit·브라우저 다운로드는 하지 않는다.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join, extname } from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright-core";

const spike = join(dirname(fileURLToPath(import.meta.url)), "..");
const TYPES = { ".js": "text/javascript", ".json": "application/json", ".wasm": "application/wasm", ".bin": "application/octet-stream", ".html": "text/html" };

export const CHROME_CANDIDATES = [
  process.env.CHROME_PATH,
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "/usr/bin/google-chrome",
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
].filter(Boolean);

/** coi=true 면 COOP/COEP 헤더를 붙여 crossOriginIsolated(= wasm 스레드 가능) 환경을 만든다 */
export async function startServer({ coi }) {
  const server = createServer(async (req, res) => {
    const url = new URL(req.url, "http://x").pathname;
    let file = null;
    if (url === "/") file = null;
    else if (url === "/worker.js") file = join(spike, "out", "worker.js");
    else if (url.startsWith("/model/")) file = join(spike, "model", url.slice(7));
    else if (url.startsWith("/wasm/")) file = join(spike, "browser", "wasm", url.slice(6));
    const h = { "Cache-Control": "no-store" };
    if (coi) Object.assign(h, { "Cross-Origin-Opener-Policy": "same-origin", "Cross-Origin-Embedder-Policy": "require-corp", "Cross-Origin-Resource-Policy": "same-origin" });
    if (url === "/") { res.writeHead(200, { ...h, "Content-Type": "text/html" }); res.end("<!doctype html><title>spike</title>"); return; }
    if (!file || !existsSync(file)) { res.writeHead(404, h); res.end(); return; }
    res.writeHead(200, { ...h, "Content-Type": TYPES[extname(file)] ?? "application/octet-stream" });
    res.end(await readFile(file));
  });
  await new Promise((r) => server.listen(0, "127.0.0.1", r));
  return { server, origin: `http://127.0.0.1:${server.address().port}` };
}

export async function launch({ coi = false, gpu = false } = {}) {
  const executablePath = CHROME_CANDIDATES.find((p) => existsSync(p));
  if (!executablePath) throw new Error("Chrome 을 찾지 못했습니다. CHROME_PATH 환경변수로 지정하세요.");
  const { server, origin } = await startServer({ coi });
  const args = gpu ? ["--use-angle=d3d11", "--enable-gpu", "--ignore-gpu-blocklist"] : [];
  const browser = await chromium.launch({ executablePath, headless: true, args });
  const page = await browser.newPage();
  const requests = [];
  page.on("request", (r) => requests.push(new URL(r.url()).pathname));
  await page.goto(origin + "/");
  await page.evaluate(async (o) => {
    const w = new Worker(o + "/worker.js");
    let id = 0;
    const pending = new Map();
    w.onmessage = (e) => {
      const p = pending.get(e.data.id);
      if (p) { pending.delete(e.data.id); e.data.error ? p.reject(new Error(e.data.error)) : p.resolve(e.data.ok); }
      else if (e.data.error) for (const q of pending.values()) q.reject(new Error(e.data.error));
    };
    window.__call = (msg, transfer) => new Promise((resolve, reject) => {
      const i = ++id;
      pending.set(i, { resolve, reject });
      w.postMessage({ ...msg, id: i }, transfer ?? []);
    });
    window.__transcribe = (b64) => {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      const samples = new Float32Array(u8.buffer);
      return window.__call({ type: "transcribe", samples }, [samples.buffer]);
    };
    // 파일 디코딩(앱과 같은 OfflineAudioContext 경로) → 모노 Float32 base64
    window.__decode = async (b64, sr) => {
      const bin = atob(b64);
      const u8 = new Uint8Array(bin.length);
      for (let k = 0; k < bin.length; k++) u8[k] = bin.charCodeAt(k);
      const ctx = new OfflineAudioContext(1, 1, sr);
      const a = await ctx.decodeAudioData(u8.buffer);
      const mono = new Float32Array(a.length);
      for (let c = 0; c < a.numberOfChannels; c++) {
        const d = a.getChannelData(c);
        for (let k = 0; k < a.length; k++) mono[k] += d[k] / a.numberOfChannels;
      }
      const bytes = new Uint8Array(mono.buffer);
      let s = "";
      for (let k = 0; k < bytes.length; k += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(k, k + 0x8000));
      return { sr: a.sampleRate, b64: btoa(s) };
    };
  }, origin);
  const call = (msg, timeoutMs = 20 * 60 * 1000) => {
    let timer;
    return Promise.race([
      page.evaluate((m) => window.__call(m), msg),
      new Promise((_, rej) => { timer = setTimeout(() => rej(new Error("timeout " + timeoutMs + "ms")), timeoutMs); }),
    ]).finally(() => clearTimeout(timer));
  };
  return { browser, page, server, origin, call, requests, close: async () => { await browser.close(); server.close(); } };
}
