import { useEffect, useMemo, useState } from 'react';
import { coverUrl } from '../api/base';
import { buildTheme, DEFAULT_THEME, dominantColor, ensureContrast, parseColor, readableTextColor, toHex, type CoverTheme, type RGB } from '../utils/color';

const cache = new Map<number, RGB | null>();
const FALLBACK_ACCENT = '#1db954';

export interface CoverPalette extends CoverTheme {
  accent: string;
  accentText: string;
  fromCover: boolean;
}

function extract(img: HTMLImageElement): RGB | null {
  const canvas = document.createElement('canvas');
  canvas.width = 32;
  canvas.height = 32;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, 32, 32);
  return dominantColor(ctx.getImageData(0, 0, 32, 32).data, [64, 64, 64]);
}

export function useCoverTheme(trackId: number | null | undefined): CoverPalette {
  const [result, setResult] = useState<{ id: number; rgb: RGB | null } | null>(null);

  useEffect(() => {
    if (!trackId || cache.has(trackId)) return;
    let cancelled = false;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      let rgb: RGB | null = null;
      try { rgb = extract(img); } catch { rgb = null; }
      cache.set(trackId, rgb);
      if (!cancelled) setResult({ id: trackId, rgb });
    };
    img.onerror = () => {
      cache.set(trackId, null);
      if (!cancelled) setResult({ id: trackId, rgb: null });
    };
    img.src = coverUrl(trackId);
    return () => {
      cancelled = true;
      img.onload = null;
      img.onerror = null;
    };
  }, [trackId]);

  const rgb = trackId ? cache.get(trackId) ?? (result?.id === trackId ? result.rgb : null) : null;
  return useMemo(() => {
    if (!rgb) return { ...DEFAULT_THEME, accent: FALLBACK_ACCENT, accentText: '#000000', fromCover: false };
    const t = buildTheme(rgb);
    const bg = parseColor(t.background) ?? ([18, 18, 18] as RGB);
    const accent = ensureContrast(rgb, bg, 3);
    return { ...t, accent: toHex(accent), accentText: readableTextColor(accent), fromCover: true };
  }, [rgb]);
}
