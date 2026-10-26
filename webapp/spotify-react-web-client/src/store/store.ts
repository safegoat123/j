import { FLUSH, PAUSE, PERSIST, PURGE, REGISTER, REHYDRATE, persistReducer, persistStore } from 'redux-persist';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import storage from 'redux-persist/es/storage'; // localStorage (ESM build for Vite)
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import { api } from './api';

import uiReducer, { PERSISTED_UI_KEYS } from './slices/ui';
import playerReducer, { bindAudioEvents, PERSISTED_PLAYER_KEYS } from './slices/player';

// Only user *settings* of the player are persisted – never isPlaying/currentTime/queue.
const playerPersisted = persistReducer(
  { key: 'vinyl-player', storage, whitelist: [...PERSISTED_PLAYER_KEYS] },
  playerReducer
);

// Modal state must not survive a reload; only the queue-panel preference does.
const uiPersisted = persistReducer(
  { key: 'vinyl-ui', storage, whitelist: [...PERSISTED_UI_KEYS] },
  uiReducer
);

const rootReducer = combineReducers({
  ui: uiPersisted,
  player: playerPersisted,
  [api.reducerPath]: api.reducer,
});

export const store = configureStore({
  reducer: rootReducer,
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: { ignoredActions: [FLUSH, REHYDRATE, PAUSE, PERSIST, PURGE, REGISTER] },
    }).concat(api.middleware),
});

setupListeners(store.dispatch);

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;

export const useAppDispatch = () => useDispatch<AppDispatch>();
export const useAppSelector: TypedUseSelectorHook<RootState> = useSelector;

export const persistor = persistStore(store);

// Wire the single shared <audio> element to Redux.
bindAudioEvents(store);
