import { createSelector, createSlice } from '@reduxjs/toolkit';

import type { RootState } from '../store';

export type LibraryView = 'LIST' | 'COMPACT' | 'GRID';
export type LibraryFilter = 'ALL' | 'PLAYLISTS' | 'ALBUMS' | 'ARTISTS';

export interface UiState {
  queueCollapsed: boolean;
  detailsCollapsed: boolean;
  libraryCollapsed: boolean;
  libraryView: LibraryView;
  libraryFilter: LibraryFilter;
}

const initialState: UiState = {
  queueCollapsed: true,
  detailsCollapsed: true,
  libraryCollapsed: false,
  libraryView: 'LIST',
  libraryFilter: 'ALL',
};

const uiSlice = createSlice({
  name: 'ui',
  initialState,
  reducers: {
    collapseDetails(state) {
      state.detailsCollapsed = true;
    },
    toggleDetails(state) {
      state.queueCollapsed = true;
      state.detailsCollapsed = !state.detailsCollapsed;
    },
    collapseLibrary(state) {
      state.libraryCollapsed = true;
    },
    openLibrary(state) {
      state.libraryCollapsed = false;
    },
    toggleLibrary(state) {
      state.libraryCollapsed = !state.libraryCollapsed;
    },
    collapseQueue(state) {
      state.queueCollapsed = true;
    },
    toggleQueue(state) {
      state.detailsCollapsed = true;
      state.queueCollapsed = !state.queueCollapsed;
    },
    closeRightPanel(state) {
      state.queueCollapsed = true;
      state.detailsCollapsed = true;
    },
    setLibraryView(state, action: { payload: LibraryView }) {
      state.libraryView = action.payload;
    },
    setLibraryFilter(state, action: { payload: LibraryFilter }) {
      state.libraryFilter = action.payload;
    },
  },
});

export const isRightLayoutOpen = createSelector(
  [(state: RootState) => state.ui.queueCollapsed, (state: RootState) => state.ui.detailsCollapsed],
  (queueCollapsed, detailsCollapsed) => !queueCollapsed || !detailsCollapsed
);

export const getLibraryCollapsed = (state: RootState) => state.ui.libraryCollapsed;

export const uiActions = uiSlice.actions;

export default uiSlice.reducer;
