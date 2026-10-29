/**
 * 마이크 입력을 고정 hop(processorOptions.hop 샘플) 단위로 묶어 메인 스레드로 보낸다.
 * 메시지: { samples: Float32Array(hop, 모노), endTime: 블록 마지막 샘플 다음 시각(오디오 시계, 초) }
 * 샘플은 메인에서 메모리 분석만 하고 저장·전송하지 않는다.
 */
class HopCaptureProcessor extends AudioWorkletProcessor {
  constructor(options) {
    super();
    this.hop = Math.max(1, (options && options.processorOptions && options.processorOptions.hop) | 0 || 128);
    this.buf = new Float32Array(this.hop);
    this.n = 0;
    this.alive = true;
    this.port.onmessage = (e) => {
      if (e.data === "stop") this.alive = false;
    };
  }

  process(inputs) {
    if (!this.alive) return false;
    const chans = inputs[0];
    if (!chans || chans.length === 0) return true; // 입력 없음(연결 전·후)
    const len = chans[0].length;
    const nc = chans.length;
    for (let i = 0; i < len; i++) {
      let v = 0;
      for (let c = 0; c < nc; c++) v += chans[c][i];
      this.buf[this.n++] = v / nc;
      if (this.n === this.hop) {
        const endTime = currentTime + (i + 1) / sampleRate;
        this.port.postMessage({ samples: this.buf, endTime }, [this.buf.buffer]);
        this.buf = new Float32Array(this.hop);
        this.n = 0;
      }
    }
    return true;
  }
}

registerProcessor("hop-capture", HopCaptureProcessor);
