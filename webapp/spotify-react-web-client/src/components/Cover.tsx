import { memo, useState, type CSSProperties } from 'react';
import { FaMusic } from 'react-icons/fa';
import { coverUrl } from '../api/base';

interface Props { trackId?: number | null; size?: number | string; alt?: string; className?: string; round?: boolean }

export const Cover = memo(({ trackId, size = 48, alt = '', className = '', round }: Props) => {
  const [failedId, setFailedId] = useState<number | null>(null);
  const style: CSSProperties = { width: size, height: size };
  if (round) style.borderRadius = '50%';
  if (!trackId || failedId === trackId) {
    return <div className={`cover cover--empty ${className}`} style={style} role="img" aria-label={alt || '커버 없음'}><FaMusic aria-hidden /></div>;
  }
  return <img className={`cover ${className}`} style={style} src={coverUrl(trackId)} alt={alt} crossOrigin="anonymous" loading="lazy" decoding="async" onError={() => setFailedId(trackId)} />;
});
Cover.displayName = 'Cover';
