import { memo, useCallback } from 'react';
import { Dropdown, Tag, type MenuProps } from 'antd';
import { Link } from 'react-router-dom';
import { FaEllipsisH, FaPlay, FaVolumeUp } from 'react-icons/fa';
import type { Track } from '../../api/types';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { currentTrackOf, addToQueue, playNext, playTracks } from '../../store/slices/player';
import { uiActions } from '../../store/slices/ui';
import { Cover } from '../Cover';
import { LikeButton } from '../LikeButton';
import { formatTime } from '../../utils/format';

export interface ExtraAction {
  key: string; label: string; danger?: boolean;
  disabled?: (index: number) => boolean;
  onClick: (track: Track, index: number) => void;
}
export const statusTag = (t: Track) =>
  t.missing ? <Tag color="red">파일 없음</Tag>
  : !t.playable ? <Tag color="orange">{(t.format ?? '?').toUpperCase()} 재생 불가</Tag>
  : t.error ? <Tag color="gold">메타데이터 오류</Tag>
  : null;

interface Props { tracks: Track[]; showAlbum?: boolean; showCover?: boolean; extraActions?: ExtraAction[]; emptyText?: string }
export const TrackList = memo(({ tracks, showAlbum = true, showCover = true, extraActions = [], emptyText = '곡이 없습니다.' }: Props) => {
  const dispatch = useAppDispatch();
  const currentId = useAppSelector((s) => currentTrackOf(s.player)?.id);
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const play = useCallback((i: number) => dispatch(playTracks(tracks, i)), [dispatch, tracks]);
  if (!tracks.length) return <p className="empty">{emptyText}</p>;
  return <div className="tracklist" role="list">
    {tracks.map((t, i) => {
      const active = t.id === currentId;
      const items: MenuProps['items'] = [
        { key: 'next', label: '다음에 재생', disabled: !t.playable },
        { key: 'queue', label: '대기열에 추가', disabled: !t.playable },
        { key: 'playlist', label: '재생목록에 추가' },
        ...(t.album_key ? [{ key: 'album', label: <Link to={`/album/${encodeURIComponent(t.album_key)}`}>앨범으로 이동</Link> }] : []),
        ...(t.artist_key ? [{ key: 'artist', label: <Link to={`/artist/${encodeURIComponent(t.artist_key)}`}>아티스트로 이동</Link> }] : []),
        ...(extraActions.length ? [{ type: 'divider' as const }] : []),
        ...extraActions.map((a) => ({ key: `x-${a.key}`, label: a.label, danger: a.danger, disabled: a.disabled?.(i) })),
      ];
      const onMenu: MenuProps['onClick'] = ({ key, domEvent }) => {
        domEvent.stopPropagation();
        if (key === 'next') dispatch(playNext(t));
        else if (key === 'queue') dispatch(addToQueue([t]));
        else if (key === 'playlist') dispatch(uiActions.openPlaylistPicker([t.id]));
        else if (key.startsWith('x-')) extraActions.find((a) => `x-${a.key}` === key)?.onClick(t, i);
      };
      return <div key={`${t.id}-${i}`} role="listitem" className={`track-row${active ? ' is-active' : ''}${!t.playable ? ' is-disabled' : ''}`} onDoubleClick={() => t.playable && play(i)}>
        <button type="button" className="track-row__index" aria-label={`${t.title} 재생`} onClick={() => play(i)} disabled={!t.playable}>
          <span className="num">{active && isPlaying ? <FaVolumeUp aria-hidden /> : i + 1}</span><span className="play"><FaPlay aria-hidden /></span>
        </button>
        <div className="track-row__main">
          {showCover && <Cover trackId={t.has_cover ? t.id : null} size={40} />}
          <div className="track-row__text"><div className="track-row__title">{t.title} {statusTag(t)}</div>
            <div className="track-row__sub">{t.artist_key ? <Link to={`/artist/${encodeURIComponent(t.artist_key)}`}>{t.artist}</Link> : t.artist ?? '알 수 없는 아티스트'}</div></div>
        </div>
        {showAlbum && <div className="track-row__album">{t.album_key ? <Link to={`/album/${encodeURIComponent(t.album_key)}`}>{t.album}</Link> : t.album ?? ''}</div>}
        <div className="track-row__actions"><LikeButton trackId={t.id} liked={t.liked} /><span className="track-row__time">{formatTime(t.duration)}</span>
          <Dropdown menu={{ items, onClick: onMenu }} trigger={['click']}><button type="button" className="icon-btn" aria-label="더 보기" onClick={(e) => e.stopPropagation()}><FaEllipsisH /></button></Dropdown>
        </div>
      </div>;
    })}
  </div>;
});
TrackList.displayName = 'TrackList';
