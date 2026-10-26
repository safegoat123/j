import { useEffect, useState } from 'react';
import ColorThief from 'colorthief';
import { coverUrl } from '../api/local';
import { RGB } from '../utils/color';

const cache = new Map<number, RGB | null>(); // 트랙 id별 메모리 캐시 (localStorage 사용 안 함)

/** 커버에서 대표색 추출. 실패하면 null → 호출 쪽에서 기본 테마 사용 */
export function useAlbumColor(trackId?: number, hasCover?: number): RGB | null {
  const [color, setColor] = useState<RGB | null>(null);
  useEffect(() => {
    if (trackId === undefined || !hasCover) { setColor(null); return; }
    if (cache.has(trackId)) { setColor(cache.get(trackId) ?? null); return; }
    let alive = true;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let c: RGB | null = null;
      try { c = new ColorThief().getColor(img) as RGB; } catch { c = null; }
      cache.set(trackId, c);
      if (alive) setColor(c);
    };
    img.onerror = () => { cache.set(trackId, null); if (alive) setColor(null); };
    img.src = coverUrl(trackId);
    return () => { alive = false; };
  }, [trackId, hasCover]);
  return color;
}
