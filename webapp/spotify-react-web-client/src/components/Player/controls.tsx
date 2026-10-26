import { memo, useState } from 'react';
import { Slider } from 'antd';
import { FaPause, FaPlay, FaRandom, FaRedo, FaStepBackward, FaStepForward, FaVolumeMute, FaVolumeUp } from 'react-icons/fa';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { currentTrackOf, nextTrack, playerActions, previousTrack, seekTo, togglePlay } from '../../store/slices/player';
import { formatTime } from '../../utils/format';

const REPEAT_LABEL = { off: '끔', all: '전체 반복', one: '한 곡 반복' } as const;
export const PlayerControls = memo(({ size = 'md' }: { size?: 'md' | 'lg' }) => {
  const dispatch = useAppDispatch();
  const hasTrack = useAppSelector((s) => !!currentTrackOf(s.player));
  const isPlaying = useAppSelector((s) => s.player.isPlaying);
  const shuffle = useAppSelector((s) => s.player.shuffle);
  const repeatMode = useAppSelector((s) => s.player.repeatMode);
  return <div className={`controls controls--${size}`}>
    <button type="button" className={`icon-btn ctrl-secondary${shuffle ? ' is-active' : ''}`} aria-pressed={shuffle} aria-label="셔플" onClick={() => dispatch(playerActions.toggleShuffle())}><FaRandom /></button>
    <button type="button" className="icon-btn" aria-label="이전 곡" disabled={!hasTrack} onClick={() => dispatch(previousTrack())}><FaStepBackward /></button>
    <button type="button" className="play-btn" aria-label={isPlaying ? '일시정지' : '재생'} disabled={!hasTrack} onClick={() => dispatch(togglePlay())}>{isPlaying ? <FaPause /> : <FaPlay className="nudge" />}</button>
    <button type="button" className="icon-btn" aria-label="다음 곡" disabled={!hasTrack} onClick={() => dispatch(nextTrack(false))}><FaStepForward /></button>
    <button type="button" className={`icon-btn ctrl-secondary repeat${repeatMode !== 'off' ? ' is-active' : ''}`} aria-label={`반복: ${REPEAT_LABEL[repeatMode]}`} title={`반복: ${REPEAT_LABEL[repeatMode]}`} onClick={() => dispatch(playerActions.cycleRepeat())}><FaRedo />{repeatMode === 'one' && <span className="repeat-one">1</span>}</button>
  </div>;
});
PlayerControls.displayName = 'PlayerControls';

export const SeekBar = memo(() => {
  const dispatch = useAppDispatch();
  const currentTime = useAppSelector((s) => s.player.currentTime);
  const duration = useAppSelector((s) => s.player.duration);
  const hasTrack = useAppSelector((s) => !!currentTrackOf(s.player));
  const [drag, setDrag] = useState<number | null>(null);
  const value = drag ?? currentTime;
  return <div className="seek" role="group" aria-label="재생 위치">
    <span className="time">{formatTime(value)}</span>
    <Slider className="seek__slider" min={0} max={Math.max(duration, 0.1)} step={0.1} value={Math.min(value, duration || 0)} disabled={!hasTrack || !duration}
      tooltip={{ formatter: (v) => formatTime(v ?? 0) }} onChange={(v: number) => setDrag(v)}
      onChangeComplete={(v: number) => { dispatch(seekTo(v)); setDrag(null); }} />
    <span className="time">{formatTime(duration)}</span>
  </div>;
});
SeekBar.displayName = 'SeekBar';

export const VolumeControl = memo(() => {
  const dispatch = useAppDispatch();
  const volume = useAppSelector((s) => s.player.volume);
  const muted = useAppSelector((s) => s.player.muted);
  return <div className="volume" role="group" aria-label="음량">
    <button type="button" className="icon-btn" aria-label={muted ? '음소거 해제' : '음소거'} aria-pressed={muted} onClick={() => dispatch(playerActions.toggleMute())}>{muted || volume === 0 ? <FaVolumeMute /> : <FaVolumeUp />}</button>
    <Slider className="volume__slider" min={0} max={1} step={0.01} value={muted ? 0 : volume} tooltip={{ formatter: (v) => `${Math.round((v ?? 0) * 100)}%` }} onChange={(v: number) => dispatch(playerActions.setVolume(v))} />
  </div>;
});
VolumeControl.displayName = 'VolumeControl';
