import { memo, useEffect, useRef, type ReactNode } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { FaCog, FaCompactDisc, FaHeart, FaHome, FaPlus, FaSearch } from 'react-icons/fa';
import { MdLibraryMusic } from 'react-icons/md';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { uiActions } from '../../store/slices/ui';
import { usePlaylistsQuery } from '../../store/api';
import PlayingBar from '../PlayingBar';
import QueuePanel from '../QueuePanel';
import { PlaylistModals } from '../Modals/PlaylistModals';

const NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: '홈', icon: <FaHome />, end: true },
  { to: '/search', label: '검색', icon: <FaSearch /> },
  { to: '/library', label: '보관함', icon: <MdLibraryMusic /> },
  { to: '/collection/tracks', label: '좋아요 표시한 곡', icon: <FaHeart /> },
  { to: '/settings', label: '라이브러리 관리', icon: <FaCog /> },
];
const Sidebar = memo(() => {
  const dispatch = useAppDispatch();
  const { data: playlists = [], isError } = usePlaylistsQuery();
  return <aside className="sidebar" aria-label="탐색">
    <div className="brand"><FaCompactDisc aria-hidden /> Vinyl Music</div>
    <nav className="nav">{NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className="nav__link">{n.icon}<span>{n.label}</span></NavLink>)}</nav>
    <div className="sidebar__section"><span>재생목록</span><button type="button" className="icon-btn" aria-label="새 재생목록" onClick={() => dispatch(uiActions.openCreatePlaylist())}><FaPlus /></button></div>
    {isError ? <p className="muted small">로컬 서버에 연결할 수 없습니다.</p> : playlists.length === 0 ? <p className="muted small">아직 재생목록이 없습니다.</p> :
      <ul className="sidebar__playlists">{playlists.map((p) => <li key={p.id}><NavLink to={`/playlist/${p.id}`} className="nav__link nav__link--sub"><span className="ellipsis">{p.name}</span><span className="muted small">{p.track_count}</span></NavLink></li>)}</ul>}
  </aside>;
});
Sidebar.displayName = 'Sidebar';
const MOBILE_NAV: { to: string; label: string; icon: ReactNode; end?: boolean }[] = [
  { to: '/', label: '홈', icon: <FaHome />, end: true },
  { to: '/search', label: '검색', icon: <FaSearch /> },
  { to: '/library', label: '보관함', icon: <MdLibraryMusic /> },
  { to: '/now-playing', label: '재생 중', icon: <FaCompactDisc /> },
];
export const AppLayout = ({ children }: { children: ReactNode }) => {
  const queueOpen = useAppSelector((s) => s.ui.queueOpen);
  const location = useLocation();
  const mainRef = useRef<HTMLElement>(null);
  useEffect(() => { mainRef.current?.scrollTo({ top: 0 }); }, [location.pathname]);
  return <div className={`app${queueOpen ? ' app--queue' : ''}`}>
    <Sidebar /><main className="main" ref={mainRef} id="main">{children}</main>
    {queueOpen && <QueuePanel />}<PlayingBar />
    <nav className="mobile-nav" aria-label="모바일 탐색">{MOBILE_NAV.map((n) => <NavLink key={n.to} to={n.to} end={n.end} className="mobile-nav__link">{n.icon}<span>{n.label}</span></NavLink>)}</nav>
    <PlaylistModals />
  </div>;
};
