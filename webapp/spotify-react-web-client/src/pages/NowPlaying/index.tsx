import { Alert, Spin } from 'antd';
import { currentTrackOf } from '../../store/slices/player';
import { useAppSelector } from '../../store/store';
import { useCoverTheme } from '../../hooks/useCoverTheme';
import { VinylPlayer } from '../../components/Vinyl';
import { PlayerControls, SeekBar, VolumeControl } from '../../components/Player/controls';
import { LikeButton } from '../../components/LikeButton';

export default function NowPlaying() {
  const track = useAppSelector((s) => currentTrackOf(s.player));
  const status = useAppSelector((s) => s.player.status);
  const error = useAppSelector((s) => s.player.error);
  const theme = useCoverTheme(track?.has_cover ? track.id : null);
  if (!track) return <div className="page page--center"><p>재생할 곡을 선택해 주세요.</p></div>;
  return <div className="page now-playing" style={{ background: theme.gradient, minHeight:'100%' }}>
    <p className="kicker">지금 재생 중</p><VinylPlayer track={track} theme={theme} />
    <div className="now-playing__meta"><h1>{track.title}</h1><p className="muted">{track.artist ?? '알 수 없는 아티스트'}{track.album ? ` · ${track.album}` : ''}</p><LikeButton trackId={track.id} liked={track.liked} /></div>
    {status === 'loading' && <Spin />} {status === 'error' && error && <Alert className="now-playing__error" type="error" message={error} />}
    <div className="now-playing__controls"><PlayerControls size="lg" /><SeekBar /><VolumeControl /></div>
  </div>;
}
