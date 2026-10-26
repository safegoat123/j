import { createSlice, type PayloadAction, type ThunkAction, type UnknownAction } from '@reduxjs/toolkit';

import { API_BASE, coverUrl, streamUrl } from '../../api/base';
import type { Track } from '../../api/types';
import { audioEngine } from '../../player/audioEngine';
import {
  nextPosition,
  previousPosition,
  removeFromOrder,
  sequential,
  shuffledOrder,
  type RepeatMode,
} from '../../player/queue';
import { api } from '../api';

export type { RepeatMode };
export type PlayerStatus = 'idle' | 'loading' | 'ready' | 'error';

export interface PlayerState {
  /** Tracks in the order they were queued. */
  queue: Track[];
  /** Play order: indices into `queue` (shuffled when `shuffle` is on). */
  order: number[];
  /** Position inside `order` of the current track, -1 when nothing is loaded. */
  index: number;
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  volume: number;
  muted: boolean;
  shuffle: boolean;
  repeatMode: RepeatMode;
  status: PlayerStatus;
  error: string | null;
}

/** Only user *settings* are persisted. Never isPlaying/currentTime/queue. */
export const PERSISTED_PLAYER_KEYS = ['volume', 'muted', 'shuffle', 'repeatMode'] as const;

const initialState: PlayerState = {
  queue: [],
  order: [],
  index: -1,
  isPlaying: false,
  currentTime: 0,
  duration: 0,
  volume: 0.8,
  muted: false,
  shuffle: false,
  repeatMode: 'off',
  status: 'idle',
  error: null,
};

export const currentTrackOf = (s: PlayerState): Track | undefined =>
  s.index >= 0 && s.index < s.order.length ? s.queue[s.order[s.index]] : undefined;

type SyncPatch = Partial<Pick<PlayerState, 'isPlaying' | 'currentTime' | 'duration' | 'status' | 'error'>>;

const slice = createSlice({
  name: 'player',
  initialState,
  reducers: {
    setQueue(state, action: PayloadAction<{ tracks: Track[]; start: number }>) {
      const { tracks } = action.payload;
      state.queue = tracks;
      state.error = null;
      state.currentTime = 0;
      if (tracks.length === 0) {
        state.order = [];
        state.index = -1;
        state.duration = 0;
        state.status = 'idle';
        return;
      }
      const start = Math.min(Math.max(action.payload.start, 0), tracks.length - 1);
      state.order = state.shuffle ? shuffledOrder(tracks.length, start) : sequential(tracks.length);
      state.index = state.shuffle ? 0 : start;
      state.duration = tracks[start].duration ?? 0;
      state.status = 'loading';
    },
    jumpTo(state, action: PayloadAction<number>) {
      const pos = action.payload;
      if (pos < 0 || pos >= state.order.length) return;
      state.index = pos;
      state.currentTime = 0;
      state.error = null;
      state.status = 'loading';
      state.duration = state.queue[state.order[pos]]?.duration ?? 0;
    },
    insertNext(state, action: PayloadAction<Track>) {
      state.queue.push(action.payload);
      state.order.splice(state.index + 1, 0, state.queue.length - 1);
    },
    appendToQueue(state, action: PayloadAction<Track[]>) {
      for (const t of action.payload) {
        state.queue.push(t);
        state.order.push(state.queue.length - 1);
      }
    },
    /** Reorder play-order entries without changing which track is selected. */
    moveInQueue(state, action: PayloadAction<{ from: number; to: number }>) {
      const { from, to } = action.payload;
      const n = state.order.length;
      if (from < 0 || from >= n || to < 0 || to >= n || from === to) return;
      const [entry] = state.order.splice(from, 1);
      state.order.splice(to, 0, entry);
      if (state.index === from) state.index = to;
      else if (from < state.index && to >= state.index) state.index -= 1;
      else if (from > state.index && to <= state.index) state.index += 1;
    },
    /** Remove the entry at `position` of the play order. The current track cannot be removed. */
    removeFromQueue(state, action: PayloadAction<number>) {
      const result = removeFromOrder(state.order, state.index, action.payload);
      if (!result) return;
      state.queue.splice(result.removedQueueIndex, 1);
      state.order = result.order;
      state.index = result.index;
    },
    toggleShuffle(state) {
      const n = state.queue.length;
      const currentQueueIndex = state.index >= 0 ? state.order[state.index] : -1;
      state.shuffle = !state.shuffle;
      if (n === 0) return;
      if (state.shuffle) {
        state.order = shuffledOrder(n, currentQueueIndex);
        state.index = currentQueueIndex >= 0 ? 0 : -1;
      } else {
        state.order = sequential(n);
        state.index = currentQueueIndex;
      }
    },
    cycleRepeat(state) {
      state.repeatMode = state.repeatMode === 'off' ? 'all' : state.repeatMode === 'all' ? 'one' : 'off';
    },
    setVolume(state, action: PayloadAction<number>) {
      state.volume = Math.min(1, Math.max(0, action.payload));
      if (state.volume > 0) state.muted = false;
    },
    toggleMute(state) {
      state.muted = !state.muted;
    },
    /** Mirror of real <audio> events. */
    sync(state, action: PayloadAction<SyncPatch>) {
      Object.assign(state, action.payload);
    },
    fail(state, action: PayloadAction<string>) {
      state.status = 'error';
      state.error = action.payload;
      state.isPlaying = false;
    },
    finished(state) {
      state.isPlaying = false;
      state.currentTime = 0;
      state.status = 'ready';
    },
    clearQueue(state) {
      state.queue = [];
      state.order = [];
      state.index = -1;
      state.isPlaying = false;
      state.currentTime = 0;
      state.duration = 0;
      state.status = 'idle';
      state.error = null;
    },
  },
});

export const playerActions = slice.actions;
export default slice.reducer;

// ---------------------------------------------------------------------------------------------
// Thunks – the only place that talks to the audio element.
// ---------------------------------------------------------------------------------------------

type PlayerRoot = { player: PlayerState };
type PlayerThunk<R = void> = ThunkAction<R, PlayerRoot, unknown, UnknownAction>;

const isAbort = (e: unknown): boolean => e instanceof DOMException && e.name === 'AbortError';

const playErrorMessage = (e: unknown): string =>
  e instanceof DOMException && e.name === 'NotAllowedError'
    ? '브라우저가 자동 재생을 막았습니다. 재생 버튼을 눌러 주세요.'
    : '재생을 시작하지 못했습니다.';

/** Load and play whatever track is currently selected in the queue. */
export const startCurrent =
  (): PlayerThunk =>
  (dispatch, getState) => {
    const track = currentTrackOf(getState().player);
    if (!track) {
      audioEngine.pause();
      return;
    }
    if (track.missing) {
      audioEngine.pause();
      dispatch(playerActions.fail('파일을 찾을 수 없습니다. 보관함에서 다시 스캔해 주세요.'));
      return;
    }
    if (!track.playable) {
      audioEngine.pause();
      dispatch(
        playerActions.fail(
          `이 브라우저에서 재생할 수 없는 형식입니다 (${(track.format ?? '알 수 없음').toUpperCase()}).`
        )
      );
      return;
    }
    audioEngine.load(streamUrl(track.id));
    audioEngine
      .play()
      .then(() => {
        // Count a play in the history once the browser really started playback.
        void fetch(`${API_BASE}/api/history/${track.id}`, { method: 'POST' })
          .then(() => dispatch(api.util.invalidateTags(['History']) as unknown as UnknownAction))
          .catch(() => undefined);
      })
      .catch((e: unknown) => {
        if (isAbort(e)) return;
        dispatch(playerActions.fail(playErrorMessage(e)));
      });
  };

/** Replace the queue and start playing `tracks[start]`. */
export const playTracks =
  (tracks: Track[], start = 0): PlayerThunk =>
  (dispatch) => {
    dispatch(playerActions.setQueue({ tracks, start }));
    dispatch(startCurrent());
  };

/** Play `track` right after the current one (or start playing if the queue is empty). */
export const playNext =
  (track: Track): PlayerThunk =>
  (dispatch, getState) => {
    if (getState().player.queue.length === 0) {
      dispatch(playTracks([track], 0));
      return;
    }
    dispatch(playerActions.insertNext(track));
  };

export const addToQueue =
  (tracks: Track[]): PlayerThunk =>
  (dispatch, getState) => {
    if (tracks.length === 0) return;
    if (getState().player.queue.length === 0) {
      dispatch(playTracks(tracks, 0));
      return;
    }
    dispatch(playerActions.appendToQueue(tracks));
  };

/** Jump to an entry of the play order (used by the queue panel). */
export const playQueuePosition =
  (position: number): PlayerThunk =>
  (dispatch) => {
    dispatch(playerActions.jumpTo(position));
    dispatch(startCurrent());
  };

/** Stop playback and remove the source before clearing the queue. */
export const stopAndClear =
  (): PlayerThunk =>
  (dispatch) => {
    audioEngine.pause();
    audioEngine.element.removeAttribute('src');
    audioEngine.element.load();
    dispatch(playerActions.clearQueue());
  };

/**
 * Go to the next playable track. `auto` is true when the previous track ended on its own –
 * then "repeat one" restarts the track and the end of the queue stops playback.
 */
export const nextTrack =
  (auto = false): PlayerThunk =>
  (dispatch, getState) => {
    const s = getState().player;
    const n = s.order.length;
    if (n === 0) return;
    if (auto && s.repeatMode === 'one') {
      audioEngine.seek(0);
      audioEngine.play().catch((e: unknown) => {
        if (!isAbort(e)) dispatch(playerActions.fail(playErrorMessage(e)));
      });
      return;
    }
    const step = nextPosition(s.order, s.index, s.repeatMode, (qi) => !!s.queue[qi]?.playable, auto);
    if (step.kind === 'go') {
      dispatch(playerActions.jumpTo(step.position));
      dispatch(startCurrent());
    } else if (step.kind === 'end') {
      dispatch(playerActions.finished());
    } else if (auto) {
      dispatch(playerActions.fail('재생할 수 있는 다음 곡이 없습니다.'));
    }
  };

export const previousTrack =
  (): PlayerThunk =>
  (dispatch, getState) => {
    const s = getState().player;
    const n = s.order.length;
    if (n === 0) return;
    const restart = () => {
      audioEngine.seek(0);
      dispatch(playerActions.sync({ currentTime: 0 }));
    };
    // Like most players: restart the track if it has been playing for a few seconds.
    if (audioEngine.element.currentTime > 3) {
      restart();
      return;
    }
    const step = previousPosition(s.order, s.index, s.repeatMode, (qi) => !!s.queue[qi]?.playable);
    if (step.kind === 'go') {
      dispatch(playerActions.jumpTo(step.position));
      dispatch(startCurrent());
      return;
    }
    // Nothing before the first track: just restart it.
    restart();
  };

export const togglePlay =
  (): PlayerThunk =>
  (dispatch, getState) => {
    const s = getState().player;
    if (!currentTrackOf(s)) return;
    if (s.status === 'error' || !audioEngine.element.getAttribute('src')) {
      dispatch(startCurrent());
      return;
    }
    if (audioEngine.element.paused) {
      audioEngine.play().catch((e: unknown) => {
        if (!isAbort(e)) dispatch(playerActions.fail(playErrorMessage(e)));
      });
    } else {
      audioEngine.pause();
    }
  };

export const seekTo =
  (seconds: number): PlayerThunk =>
  (dispatch) => {
    audioEngine.seek(seconds);
    dispatch(playerActions.sync({ currentTime: audioEngine.element.currentTime }));
  };

// ---------------------------------------------------------------------------------------------
// Real audio events -> Redux. timeupdate fires ~4×/s; nothing here runs per animation frame.
// ---------------------------------------------------------------------------------------------

interface BindableStore {
  dispatch: (action: never) => unknown;
  getState: () => PlayerRoot;
  subscribe: (listener: () => void) => () => void;
}

const mediaErrorMessage = (el: HTMLAudioElement): string => {
  switch (el.error?.code) {
    case 2:
      return '네트워크 오류로 재생할 수 없습니다. 서버가 실행 중인지 확인해 주세요.';
    case 3:
      return '파일이 손상되어 디코딩할 수 없습니다.';
    case 4:
      return '지원하지 않는 형식이거나 파일을 열 수 없습니다.';
    default:
      return '재생 중 오류가 발생했습니다.';
  }
};

export const bindAudioEvents = (store: BindableStore): (() => void) => {
  const el = audioEngine.element;
  const send = (action: unknown) => (store.dispatch as (a: unknown) => unknown)(action);
  const sync = (patch: SyncPatch) => send(playerActions.sync(patch));

  const onPlay = () => sync({ isPlaying: true });
  const onPause = () => sync({ isPlaying: false });
  const onTime = () => sync({ currentTime: el.currentTime });
  const onDuration = () => {
    if (Number.isFinite(el.duration) && el.duration > 0) sync({ duration: el.duration });
  };
  const onWaiting = () => sync({ status: 'loading' });
  const onReady = () => sync({ status: 'ready', error: null });
  const onError = () => {
    if (!el.getAttribute('src')) return;
    send(playerActions.fail(mediaErrorMessage(el)));
  };
  const onEnded = () => send(nextTrack(true));

  el.addEventListener('play', onPlay);
  el.addEventListener('pause', onPause);
  el.addEventListener('timeupdate', onTime);
  el.addEventListener('durationchange', onDuration);
  el.addEventListener('loadedmetadata', onDuration);
  el.addEventListener('waiting', onWaiting);
  el.addEventListener('playing', onReady);
  el.addEventListener('canplay', onReady);
  el.addEventListener('error', onError);
  el.addEventListener('ended', onEnded);

  // Keep the element's volume/mute in line with the (persisted) Redux settings, including after
  // redux-persist rehydrates them.
  let lastTrackId: number | undefined;
  const unsubscribe = store.subscribe(() => {
    const s = store.getState().player;
    if (el.volume !== s.volume) audioEngine.setVolume(s.volume);
    if (el.muted !== s.muted) audioEngine.setMuted(s.muted);

    const track = currentTrackOf(s);
    if (track?.id !== lastTrackId) {
      lastTrackId = track?.id;
      updateMediaSession(track);
    }
  });

  registerMediaSessionHandlers(send);

  return () => {
    unsubscribe();
    el.removeEventListener('play', onPlay);
    el.removeEventListener('pause', onPause);
    el.removeEventListener('timeupdate', onTime);
    el.removeEventListener('durationchange', onDuration);
    el.removeEventListener('loadedmetadata', onDuration);
    el.removeEventListener('waiting', onWaiting);
    el.removeEventListener('playing', onReady);
    el.removeEventListener('canplay', onReady);
    el.removeEventListener('error', onError);
    el.removeEventListener('ended', onEnded);
  };
};

// Media keys / lock-screen controls.
function updateMediaSession(track: Track | undefined): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  if (!track) {
    navigator.mediaSession.metadata = null;
    return;
  }
  navigator.mediaSession.metadata = new MediaMetadata({
    title: track.title,
    artist: track.artist ?? '',
    album: track.album ?? '',
    artwork: track.has_cover ? [{ src: coverUrl(track.id) }] : [],
  });
}

function registerMediaSessionHandlers(send: (action: unknown) => unknown): void {
  if (typeof navigator === 'undefined' || !('mediaSession' in navigator)) return;
  const set = (action: MediaSessionAction, handler: MediaSessionActionHandler | null) => {
    try {
      navigator.mediaSession.setActionHandler(action, handler);
    } catch {
      /* action not supported by this browser */
    }
  };
  set('play', () => send(togglePlay()));
  set('pause', () => send(togglePlay()));
  set('previoustrack', () => send(previousTrack()));
  set('nexttrack', () => send(nextTrack(false)));
  set('seekto', (details) => {
    if (typeof details.seekTime === 'number') send(seekTo(details.seekTime));
  });
}
