import type { ReactNode } from 'react';
import { Alert, Spin } from 'antd';
import { useCoverTheme } from '../hooks/useCoverTheme';
import { errorMessage } from '../store/api';
import { Cover } from './Cover';

interface Props { coverTrackId: number | null; kicker: string; title: ReactNode; meta?: ReactNode; round?: boolean; actions?: ReactNode }
export function PageHeader({ coverTrackId, kicker, title, meta, round, actions }: Props) {
  const theme = useCoverTheme(coverTrackId);
  return (
    <header className="page-header" style={{ background: theme.gradient, color: theme.text }}>
      <div className="page-header__row">
        <Cover trackId={coverTrackId} size={180} round={round} className="page-header__cover" />
        <div className="page-header__text"><span className="kicker">{kicker}</span><h1>{title}</h1>
          {meta && <div style={{ color: theme.mutedText }}>{meta}</div>}</div>
      </div>
      {actions && <div className="page-header__actions">{actions}</div>}
    </header>
  );
}
export function QueryStatus({ isLoading, error, children }: { isLoading: boolean; error: unknown; children: ReactNode }) {
  if (isLoading) return <div className="page-loading"><Spin /></div>;
  if (error) return <div className="page"><Alert type="warning" showIcon message="불러오지 못했습니다" description={errorMessage(error)} /></div>;
  return <>{children}</>;
}
