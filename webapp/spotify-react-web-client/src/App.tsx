import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { PersistGate } from 'redux-persist/integration/react';
import { App as AntApp, ConfigProvider, Spin, theme } from 'antd';
import koKR from 'antd/locale/ko_KR';
import { AppLayout } from './components/Layout';
import { persistor, store, useAppDispatch } from './store/store';
import { togglePlay } from './store/slices/player';
import './styles/global.scss';

const Home = lazy(() => import('./pages/Home'));
const Search = lazy(() => import('./pages/Search'));
const Library = lazy(() => import('./pages/Library'));
const AlbumPage = lazy(() => import('./pages/Album'));
const ArtistPage = lazy(() => import('./pages/Artist'));
const PlaylistPage = lazy(() => import('./pages/Playlist'));
const LikedSongs = lazy(() => import('./pages/LikedSongs'));
const NowPlaying = lazy(() => import('./pages/NowPlaying'));
const Settings = lazy(() => import('./pages/Settings'));
const NotFound = lazy(() => import('./pages/404'));

function useSpaceToggle() {
  const dispatch = useAppDispatch();
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Space' && e.key !== ' ') return;
      const el = e.target as HTMLElement | null;
      if (el && (el.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(el.tagName) || el.getAttribute('role') === 'slider')) return;
      e.preventDefault();
      dispatch(togglePlay());
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [dispatch]);
}
const Fallback = () => <div className="page-loading"><Spin /></div>;
function Shell() {
  useSpaceToggle();
  return <BrowserRouter><AppLayout><Suspense fallback={<Fallback />}><Routes>
    <Route path="/" element={<Home />} />
    <Route path="/search" element={<Search />} />
    <Route path="/library" element={<Library />} />
    <Route path="/album/:key" element={<AlbumPage />} />
    <Route path="/artist/:key" element={<ArtistPage />} />
    <Route path="/playlist/:id" element={<PlaylistPage />} />
    <Route path="/collection/tracks" element={<LikedSongs />} />
    <Route path="/now-playing" element={<NowPlaying />} />
    <Route path="/settings" element={<Settings />} />
    <Route path="*" element={<NotFound />} />
  </Routes></Suspense></AppLayout></BrowserRouter>;
}
export default function App() {
  return <ConfigProvider locale={koKR} theme={{ algorithm: theme.darkAlgorithm, token: { colorPrimary: '#1db954', fontFamily: 'inherit', borderRadius: 6 } }}>
    <AntApp><Provider store={store}><PersistGate loading={null} persistor={persistor}><Shell /></PersistGate></Provider></AntApp>
  </ConfigProvider>;
}
