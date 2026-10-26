// A single shared HTMLAudioElement for the whole app. Components never create their own
// audio objects – they dispatch actions (store/slices/player.ts) and read Redux state,
// which bindAudioEvents() keeps in sync with the real element.

export interface AudioEngine {
  readonly element: HTMLAudioElement;
  load(src: string): void;
  play(): Promise<void>;
  pause(): void;
  seek(seconds: number): void;
  setVolume(volume: number): void;
  setMuted(muted: boolean): void;
}

class HtmlAudioEngine implements AudioEngine {
  readonly element: HTMLAudioElement;

  constructor() {
    this.element = new Audio();
    this.element.preload = 'auto';
  }

  load(src: string): void {
    this.element.src = src;
    this.element.load();
  }

  play(): Promise<void> {
    return this.element.play();
  }

  pause(): void {
    this.element.pause();
  }

  seek(seconds: number): void {
    if (!Number.isFinite(seconds)) return;
    const max = Number.isFinite(this.element.duration) ? this.element.duration : seconds;
    this.element.currentTime = Math.min(Math.max(0, seconds), max);
  }

  setVolume(volume: number): void {
    this.element.volume = Math.min(1, Math.max(0, volume));
  }

  setMuted(muted: boolean): void {
    this.element.muted = muted;
  }
}

export const audioEngine: AudioEngine = new HtmlAudioEngine();
