import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

export interface UiState {
  /** Right-hand queue panel (desktop) – persisted. */
  queueOpen: boolean;
  /** Track ids waiting to be added to a playlist; non-null opens the picker modal. */
  playlistPickerTrackIds: number[] | null;
  createPlaylistOpen: boolean;
}

/** Only these keys survive a reload (see store.ts). */
export const PERSISTED_UI_KEYS = ['queueOpen'] as const;

const initialState: UiState = {
  queueOpen: false,
  playlistPickerTrackIds: null,
  createPlaylistOpen: false,
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    toggleQueue(state) {
      state.queueOpen = !state.queueOpen;
    },
    closeQueue(state) {
      state.queueOpen = false;
    },
    openPlaylistPicker(state, action: PayloadAction<number[]>) {
      state.playlistPickerTrackIds = action.payload;
    },
    closePlaylistPicker(state) {
      state.playlistPickerTrackIds = null;
    },
    openCreatePlaylist(state) {
      state.createPlaylistOpen = true;
    },
    closeCreatePlaylist(state) {
      state.createPlaylistOpen = false;
    },
  },
});

export const uiActions = uiSlice.actions;

export default uiSlice.reducer;
