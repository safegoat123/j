import { memo, type CSSProperties } from 'react';
import type { Track } from '../../api/types';
import type { CoverPalette } from '../../hooks/useCoverTheme';
import { useAppSelector } from '../../store/store';
import { Cover } from '../Cover';
import './vinyl.scss';

export const VinylPlayer = memo(({ track, theme }: { track: Track; theme: CoverPalette }) => {
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const progress = useAppSelector((s) => (s.player.duration ? Math.min(1, s.player.currentTime / s.player.duration) : 0));
  const armDeg = isPlaying ? 18 + progress * 22 : 0;
  const style = { '--label': theme.accent, '--label-2': theme.background, '--arm-deg': `${armDeg}deg` } as CSSProperties;
  return <div className="vinyl-stage" style={style}>
    <div className="vinyl-stage__cover"><Cover trackId={track.has_cover ? track.id : null} size="100%" alt={`${track.album ?? track.title} 커버`} /></div>
    <div className="vinyl-stage__deck">
      <div className={`vinyl-disc${isPlaying ? ' is-spinning' : ''}`} aria-hidden><div className="vinyl-disc__label"><span className="vinyl-disc__hole" /></div></div>
      <div className="tonearm" aria-hidden><span className="tonearm__base" /><span className="tonearm__arm"><span className="tonearm__head" /></span></div>
      <span className="sr-only">{isPlaying ? '재생 중' : '일시정지됨'}</span>
    </div>
  </div>;
});
VinylPlayer.displayName = 'VinylPlayer';
