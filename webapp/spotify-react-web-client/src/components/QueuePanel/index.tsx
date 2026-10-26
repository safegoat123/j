import { FaArrowDown, FaArrowUp, FaTimes } from 'react-icons/fa';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { playerActions, playQueuePosition, stopAndClear } from '../../store/slices/player';
import { uiActions } from '../../store/slices/ui';
import { Cover } from '../Cover';
import { formatTime } from '../../utils/format';

export default function QueuePanel({ inline = false }: { inline?: boolean }) {
  const dispatch = useAppDispatch();
  const queue = useAppSelector((s) => s.player.queue);
  const order = useAppSelector((s) => s.player.order);
  const index = useAppSelector((s) => s.player.index);
  return <aside className={inline ? 'queue queue--inline' : 'queue-panel queue'} aria-label="재생 대기열">
    <div className="queue__head"><h2>재생 대기열</h2><div>
      <button type="button" className="text-btn" disabled={!order.length} onClick={() => dispatch(stopAndClear())}>비우기</button>
      {!inline && <button type="button" className="icon-btn" aria-label="닫기" onClick={() => dispatch(uiActions.closeQueue())}><FaTimes /></button>}
    </div></div>
    {!order.length ? <p className="empty">대기열이 비어 있습니다. 곡을 재생하면 여기에 표시됩니다.</p> : <ol className="queue__list">
      {order.map((qi, pos) => {
        const t = queue[qi]; if (!t) return null;
        const current = pos === index;
        return <li key={`${t.id}-${pos}`} className={`queue__item${current ? ' is-current' : ''}${pos < index ? ' is-past' : ''}`}>
          <button type="button" className="queue__play" onClick={() => dispatch(playQueuePosition(pos))} disabled={!t.playable} aria-current={current ? 'true' : undefined}>
            <Cover trackId={t.has_cover ? t.id : null} size={36} /><span className="queue__text"><span className="queue__title">{current ? '▶ ' : ''}{t.title}</span>
            <span className="queue__sub">{t.artist ?? '알 수 없는 아티스트'} · {formatTime(t.duration)}</span></span>
          </button>
          <span className="queue__tools">
            <button type="button" className="icon-btn" aria-label="위로" disabled={pos === 0} onClick={() => dispatch(playerActions.moveInQueue({ from: pos, to: pos - 1 }))}><FaArrowUp /></button>
            <button type="button" className="icon-btn" aria-label="아래로" disabled={pos === order.length - 1} onClick={() => dispatch(playerActions.moveInQueue({ from: pos, to: pos + 1 }))}><FaArrowDown /></button>
            <button type="button" className="icon-btn" aria-label="대기열에서 제거" disabled={current} onClick={() => dispatch(playerActions.removeFromQueue(pos))}><FaTimes /></button>
          </span>
        </li>;
      })}
    </ol>}
  </aside>;
}
