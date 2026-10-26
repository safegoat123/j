import { memo, useState } from 'react';
import { useAppSelector } from '../../store/store';
import { current } from '../../store/slices/player';
import { coverUrl } from '../../api/local';
import { useAlbumColor } from '../../hooks/useAlbumColor';
import { textColorFor, toDarkBackground } from '../../utils/color';
import './vinyl.scss';

/** 앨범 커버 + LP 디스크 + 톤암. 모두 Redux 플레이어 상태(=실제 오디오 이벤트)만 따른다. */
export const VinylPlayer = memo(() => {
  const track = useAppSelector((s) => current(s.player));
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const progress = useAppSelector((s) => (s.player.duration ? Math.min(1, s.player.currentTime / s.player.duration) : 0));
  const [failedId, setFailedId] = useState<number | null>(null);
  const rgb = useAlbumColor(track?.id, track?.has_cover);

  const accent = rgb ? `rgb(${rgb.join(',')})` : '#1db954';
  const bg = rgb ? toDarkBackground(rgb) : '#181818';
  const showCover = !!track?.has_cover && failedId !== track.id;
  // 톤암: 정지/대기 0도(거치대), 재생 중 레코드 안쪽으로 18~40도
  const armDeg = isPlaying ? 18 + progress * 22 : 0;

  return (
    <div className="vinyl-stage" style={{ ['--album-bg' as string]: bg, ['--album-accent' as string]: accent,
      ['--album-text' as string]: textColorFor(bg) }}>
      <div className="vinyl-cover">
        {showCover && track ? (
          <img src={coverUrl(track.id)} alt={`${track.album ?? track.title} 커버`} crossOrigin="anonymous"
            onError={() => setFailedId(track.id)} />
        ) : <div className="vinyl-cover__placeholder" aria-hidden>♪</div>}
      </div>
      <div className="vinyl">
        {/* 곡이 바뀌어도 key를 바꾸지 않아 회전 각도가 이어진다. 일시정지는 animation-play-state로 각도 유지 */}
        <div className="vinyl__disc" style={{ animationPlayState: isPlaying ? 'running' : 'paused' }}>
          <div className="vinyl__label" />
        </div>
        <div className="vinyl__arm" style={{ transform: `rotate(${armDeg}deg)` }} aria-hidden />
      </div>
    </div>
  );
});
