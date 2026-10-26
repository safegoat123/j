export interface AudioEngine {
  load(src: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(t: number): void;
  setVolume(v: number): void;
  setMuted(m: boolean): void;
  readonly element: HTMLAudioElement;
}
class HtmlAudioEngine implements AudioEngine {
  readonly element = new Audio();
  constructor() { this.element.preload = 'metadata'; this.element.crossOrigin = 'anonymous'; }
  load(src: string) { this.element.src = src; this.element.load(); }
  play() { return this.element.play(); }
  pause() { this.element.pause(); }
  seek(t: number) { if (Number.isFinite(t)) this.element.currentTime = Math.max(0, t); }
  setVolume(v: number) { this.element.volume = Math.min(1, Math.max(0, v)); }
  setMuted(m: boolean) { this.element.muted = m; }
}
export const audioEngine: AudioEngine = new HtmlAudioEngine();
