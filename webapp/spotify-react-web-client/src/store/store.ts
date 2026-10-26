import { FLUSH, PAUSE, PURGE, PERSIST, REGISTER, REHYDRATE, persistStore, persistReducer } from 'redux-persist';
import { combineReducers, configureStore } from '@reduxjs/toolkit';
import { setupListeners } from '@reduxjs/toolkit/query';
import storage from 'redux-persist/es/storage'; // localStorage (ESM build for Vite)
import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';

import { api } from './api';

import uiReducer from './slices/ui';
import languageReducer from './slices/language';
import playerReducer, { bindAudioEvents, PERSISTED_PLAYER_KEYS } from './slices/player';

// Only user *settings* of the player are persisted — never isPlaying/currentTime/queue.
const playerPersisted = persistReducer(
  { key: 'player', storage, whitelist: PERSISTED_PLAYER_KEYS as string[] },
  playerReducer
);

const rootReducer = combineReducers({
  ui: uiReducer,
  language: languageReducer,
  player: playerPersisted,
  [api.reducerPath]: api.reducer,
});

const persistedReducer = persistReducer(
  { key: 'vinyl-root', storage, whitelist: ['language', 'ui'] },
  rootReducer
);

export const store = configureStore({
  reducer: persistedReducer,
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

bindAudioEvents(store as never);
