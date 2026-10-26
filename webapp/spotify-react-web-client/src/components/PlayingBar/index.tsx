import { useNavigate } from 'react-router-dom';
import { FaCompactDisc } from 'react-icons/fa';
import { MdQueueMusic } from 'react-icons/md';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { currentTrackOf } from '../../store/slices/player';
import { uiActions } from '../../store/slices/ui';
import { useTrackQuery } from '../../store/api';
import { Cover } from '../Cover';
import { LikeButton } from '../LikeButton';
import { PlayerControls, SeekBar, VolumeControl } from '../Player/controls';

export default function PlayingBar() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const track = useAppSelector((s) => currentTrackOf(s.player));
  const status = useAppSelector((s) => s.player.status);
  const error = useAppSelector((s) => s.player.error);
  const queueOpen = useAppSelector((s) => s.ui.queueOpen);
  const pct = useAppSelector((s) => (s.player.duration ? Math.min(100, (s.player.currentTime / s.player.duration) * 100) : 0));
  const { data: fresh } = useTrackQuery(track?.id ?? 0, { skip: !track });
  return <footer className="playing-bar" aria-label="플레이어">
    <div className="pb__mini-progress" style={{ width: `${pct}%` }} aria-hidden />
    <div className="pb__left">{track ? <>
      <button type="button" className="pb__cover-btn" onClick={() => navigate('/now-playing')} aria-label="재생 화면 열기"><Cover trackId={track.has_cover ? track.id : null} size={56} /></button>
      <button type="button" className="pb__meta" onClick={() => navigate('/now-playing')}><span className="pb__title" title={track.title}>{track.title}</span><span className="pb__artist">{track.artist ?? '알 수 없는 아티스트'}</span></button>
      <span className="pb-desktop"><LikeButton trackId={track.id} liked={fresh?.liked ?? track.liked} /></span>
    </> : <span className="muted">재생 중인 곡이 없습니다</span>}</div>
    <div className="pb__center"><PlayerControls /><div className="pb-desktop pb__seek"><SeekBar /></div>
      {status === 'error' && error && <div className="pb__error" role="alert">{error}</div>}</div>
    <div className="pb__right pb-desktop">
      <button type="button" className="icon-btn" aria-label="LP 재생 화면" onClick={() => navigate('/now-playing')}><FaCompactDisc /></button>
      <button type="button" className={`icon-btn${queueOpen ? ' is-active' : ''}`} aria-pressed={queueOpen} aria-label="재생 대기열" onClick={() => dispatch(uiActions.toggleQueue())}><MdQueueMusic /></button>
      <VolumeControl />
    </div>
  </footer>;
}
