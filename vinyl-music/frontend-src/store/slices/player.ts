import { createSlice, PayloadAction } from '@reduxjs/toolkit';
import { audioEngine } from '../../player/audioEngine';
import { api, streamUrl, Track } from '../../api/local';

export type RepeatMode = 'off' | 'all' | 'one';
export interface PlayerState {
  queue: Track[];          // 원본 목록
  order: number[];         // 재생 순서 (queue 인덱스). 셔플/재정렬은 이 배열만 바꾼다
  index: number;           // order 안에서의 현재 위치
  isPlaying: boolean; loading: boolean;
  currentTime: number; duration: number;
  volume: number; muted: boolean; shuffle: boolean; repeatMode: RepeatMode;
  error?: string;
}
const initialState: PlayerState = {
  queue: [], order: [], index: -1, isPlaying: false, loading: false, currentTime: 0, duration: 0,
  volume: 0.8, muted: false, shuffle: false, repeatMode: 'off',
};

const range = (n: number) => Array.from({ length: n }, (_, i) => i);
const shuffled = (n: number, first: number) => {
  const a = range(n).filter((i) => i !== first);
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return n ? [first, ...a] : [];
};
export const current = (s: PlayerState): Track | undefined =>
  s.index >= 0 ? s.queue[s.order[s.index]] : undefined;

const slice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setQueue(s, a: PayloadAction<{ tracks: Track[]; start: number }>) {
      const { tracks, start } = a.payload;
      s.queue = tracks;
      s.order = s.shuffle ? shuffled(tracks.length, start) : range(tracks.length);
      s.index = s.shuffle ? 0 : start;
      s.error = undefined;
    },
    step(s, a: PayloadAction<1 | -1>) {
      const n = s.order.length;
      if (!n) return;
      const nxt = s.index + a.payload;
      s.index = nxt >= n ? 0 : Math.max(0, nxt); // 끝 처리는 thunk에서 (repeat off 일 때 호출되지 않음)
      s.error = undefined;
    },
    jump(s, a: PayloadAction<number>) {
      if (a.payload >= 0 && a.payload < s.order.length) { s.index = a.payload; s.error = undefined; }
    },
    toggleShuffle(s) {
      const cur = s.order[s.index] ?? 0;
      s.shuffle = !s.shuffle;
      s.order = s.shuffle ? shuffled(s.queue.length, cur) : range(s.queue.length);
      s.index = s.queue.length ? (s.shuffle ? 0 : cur) : -1;
    },
    cycleRepeat(s) { s.repeatMode = s.repeatMode === 'off' ? 'all' : s.repeatMode === 'all' ? 'one' : 'off'; },
    moveInQueue(s, a: PayloadAction<{ from: number; to: number }>) {
      const { from, to } = a.payload;
      if (from === to || from < 0 || to < 0 || from >= s.order.length || to >= s.order.length) return;
      const [x] = s.order.splice(from, 1);
      s.order.splice(to, 0, x);
      if (s.index === from) s.index = to;
      else if (from < s.index && to >= s.index) s.index -= 1;
      else if (from > s.index && to <= s.index) s.index += 1;
    },
    removeFromQueue(s, a: PayloadAction<number>) {
      const pos = a.payload;
      if (pos < 0 || pos >= s.order.length) return;
      const qi = s.order[pos];
      s.queue.splice(qi, 1);
      s.order = s.order.filter((_, i) => i !== pos).map((o) => (o > qi ? o - 1 : o));
      if (pos < s.index) s.index -= 1;
      if (s.index >= s.order.length) s.index = s.order.length - 1;
    },
    clearQueue(s) { s.queue = []; s.order = []; s.index = -1; s.isPlaying = false; s.currentTime = 0; s.duration = 0; },
    _sync(s, a: PayloadAction<Partial<PlayerState>>) { Object.assign(s, a.payload); },
  },
});
export const playerActions = slice.actions;
export default slice.reducer;

// ---- thunks (사이드 이펙트는 reducer 밖에서) ----
type Dispatch = (a: any) => any;
type Thunk = (dispatch: Dispatch, getState: () => { player: PlayerState }) => unknown;

const startCurrent = (): Thunk => async (dispatch, getState) => {
  const t = current(getState().player);
  if (!t) return;
  if (t.missing || !t.playable) {
    audioEngine.pause();
    dispatch(playerActions._sync({
      isPlaying: false, loading: false,
      error: t.missing ? '파일을 찾을 수 없습니다. 설정에서 라이브러리를 다시 스캔하세요.' : '이 브라우저에서 재생할 수 없는 형식입니다.',
    }));
    return;
  }
  dispatch(playerActions._sync({ currentTime: 0, duration: t.duration ?? 0, loading: true, error: undefined }));
  audioEngine.load(streamUrl(t.id));
  void api.post(`/history/${t.id}`).catch(() => undefined);
  try {
    await audioEngine.play();
  } catch (e) {
    if ((e as DOMException)?.name !== 'AbortError') { // 빠른 연타로 load()가 play()를 끊은 경우는 정상
      dispatch(playerActions._sync({ isPlaying: false, loading: false, error: '재생을 시작하지 못했습니다.' }));
    }
  }
};

export const playTracks = (tracks: Track[], start: number): Thunk => (d) => {
  d(playerActions.setQueue({ tracks, start }));
  d(startCurrent());
};
export const jumpTo = (pos: number): Thunk => (d) => { d(playerActions.jump(pos)); d(startCurrent()); };
export const next = (): Thunk => (d, g) => {
  const p = g().player;
  if (!p.order.length) return;
  if (p.index + 1 >= p.order.length && p.repeatMode === 'off') { // 마지막 곡 이후: 정지
    audioEngine.pause(); audioEngine.seek(0); d(playerActions._sync({ isPlaying: false, currentTime: 0 }));
    return;
  }
  d(playerActions.step(1)); d(startCurrent());
};
export const prev = (): Thunk => (d) => {
  if (audioEngine.element.currentTime > 3) { audioEngine.seek(0); return; }
  d(playerActions.step(-1)); d(startCurrent());
};
export const togglePlay = (): Thunk => (_d, g) => {
  const p = g().player;
  if (!current(p)) return;
  if (p.isPlaying) audioEngine.pause();
  else void audioEngine.play().catch(() => undefined);
};
export const seek = (t: number): Thunk => (d) => { audioEngine.seek(t); d(playerActions._sync({ currentTime: t })); };
export const setVolume = (v: number): Thunk => (d) => { audioEngine.setVolume(v); d(playerActions._sync({ volume: v })); };
export const toggleMute = (): Thunk => (d, g) => {
  const m = !g().player.muted; audioEngine.setMuted(m); d(playerActions._sync({ muted: m }));
};
export const removeFromQueue = (pos: number): Thunk => (d, g) => {
  const wasCurrent = g().player.index === pos;
  d(playerActions.removeFromQueue(pos));
  if (!wasCurrent) return;
  if (current(g().player)) d(startCurrent());
  else { audioEngine.pause(); d(playerActions._sync({ isPlaying: false })); }
};
export const clearQueue = (): Thunk => (d) => { audioEngine.pause(); d(playerActions.clearQueue()); };

// 실제 오디오 이벤트 -> Redux. store 생성 직후 한 번만 호출. 반환값은 해제 함수.
export const bindAudioEvents = (store: { dispatch: Dispatch; getState: () => { player: PlayerState } }) => {
  const el = audioEngine.element;
  const sync = (p: Partial<PlayerState>) => store.dispatch(playerActions._sync(p));
  const { volume, muted } = store.getState().player;
  audioEngine.setVolume(volume); audioEngine.setMuted(muted);
  const h: Record<string, () => void> = {
    play: () => sync({ isPlaying: true }),
    pause: () => sync({ isPlaying: false }),
    playing: () => sync({ loading: false }),
    canplay: () => sync({ loading: false }),
    waiting: () => sync({ loading: true }),
    timeupdate: () => sync({ currentTime: el.currentTime }),
    loadedmetadata: () => sync({ duration: Number.isFinite(el.duration) ? el.duration : 0 }),
    error: () => sync({ isPlaying: false, loading: false, error: '재생 오류: 파일이 없거나 형식을 지원하지 않습니다.' }),
    ended: () => {
      if (store.getState().player.repeatMode === 'one') { audioEngine.seek(0); void audioEngine.play(); }
      else store.dispatch(next());
    },
  };
  Object.entries(h).forEach(([k, fn]) => el.addEventListener(k, fn));
  return () => Object.entries(h).forEach(([k, fn]) => el.removeEventListener(k, fn));
};
