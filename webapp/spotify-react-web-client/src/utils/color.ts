// Colour helpers for cover-art driven theming. Pure functions, no dependencies.
// (Replaces the old Vinyl "use-theme" logic: it only parsed rgb() although it generated rgba(),
// could not handle 3-digit hex and kept stale gradients in localStorage.)

export type RGB = [number, number, number];

const clamp255 = (n: number): number => Math.min(255, Math.max(0, Math.round(n)));

/** Parses #rgb, #rgba, #rrggbb, #rrggbbaa, rgb(), rgba() (comma or space separated). */
export function parseColor(input: string): RGB | null {
  const s = input.trim().toLowerCase();

  const fn = s.match(/^rgba?\(\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)\s*[,\s]\s*(\d{1,3}(?:\.\d+)?)/);
  if (fn) return [clamp255(Number(fn[1])), clamp255(Number(fn[2])), clamp255(Number(fn[3]))];

  if (s.startsWith('#')) {
    let hex = s.slice(1);
    if (hex.length === 3 || hex.length === 4) {
      hex = hex
        .split('')
        .map((c) => c + c)
        .join('');
    }
    if ((hex.length === 6 || hex.length === 8) && /^[0-9a-f]+$/.test(hex)) {
      return [parseInt(hex.slice(0, 2), 16), parseInt(hex.slice(2, 4), 16), parseInt(hex.slice(4, 6), 16)];
    }
  }
  return null;
}

export function toHex([r, g, b]: RGB): string {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('');
}

/** WCAG relative luminance (0..1). */
export function luminance([r, g, b]: RGB): number {
  const lin = (v: number) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
}

/** WCAG contrast ratio (1..21). */
export function contrastRatio(a: RGB, b: RGB): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white – whichever reads better on `background`. Accepts any CSS colour string we can parse. */
export function readableTextColor(background: RGB | string): '#000000' | '#ffffff' {
  const rgb = typeof background === 'string' ? parseColor(background) : background;
  if (!rgb) return '#ffffff';
  return contrastRatio(rgb, [0, 0, 0]) >= contrastRatio(rgb, [255, 255, 255]) ? '#000000' : '#ffffff';
}

const mix = (a: RGB, b: RGB, t: number): RGB => [
  clamp255(a[0] + (b[0] - a[0]) * t),
  clamp255(a[1] + (b[1] - a[1]) * t),
  clamp255(a[2] + (b[2] - a[2]) * t),
];

/**
 * Moves `fg` towards white or black (whichever helps) until it reaches `min` contrast on `bg`.
 * Used for secondary text and accent colours taken from the cover.
 */
export function ensureContrast(fg: RGB, bg: RGB, min = 4.5): RGB {
  if (contrastRatio(fg, bg) >= min) return fg;
  // Head for whichever extreme can actually give more contrast on this background
  // (mid-greys can reach 4.5:1 with black but not with white).
  const target: RGB = contrastRatio([255, 255, 255], bg) >= contrastRatio([0, 0, 0], bg) ? [255, 255, 255] : [0, 0, 0];
  for (let t = 0.05; t <= 1.0001; t += 0.05) {
    const candidate = mix(fg, target, t);
    if (contrastRatio(candidate, bg) >= min) return candidate;
  }
  return target;
}

function saturation([r, g, b]: RGB): number {
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  return max === 0 ? 0 : (max - min) / max;
}

/**
 * Picks a representative colour from RGBA pixel data (e.g. a 32×32 canvas of the cover).
 * Pixels are bucketed to 4 bits per channel; buckets are weighted by size and saturation so
 * that a colourful cover is not averaged into mud, and near-black/near-white pixels are ignored.
 */
export function dominantColor(data: ArrayLike<number>, fallback: RGB = [40, 40, 40]): RGB {
  const buckets = new Map<number, { n: number; r: number; g: number; b: number }>();
  for (let i = 0; i + 3 < data.length; i += 4) {
    const a = data[i + 3];
    if (a < 128) continue;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const lum = (r + g + b) / 3;
    if (lum < 24 || lum > 240) continue;
    const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.n += 1;
      bucket.r += r;
      bucket.g += g;
      bucket.b += b;
    } else {
      buckets.set(key, { n: 1, r, g, b });
    }
  }

  let best: RGB | null = null;
  let bestScore = -1;
  buckets.forEach((v) => {
    const avg: RGB = [v.r / v.n, v.g / v.n, v.b / v.n];
    const score = v.n * (0.25 + saturation(avg));
    if (score > bestScore) {
      bestScore = score;
      best = [clamp255(avg[0]), clamp255(avg[1]), clamp255(avg[2])];
    }
  });
  return best ?? fallback;
}

export interface CoverTheme {
  /** Dominant colour of the cover, darkened so it can sit behind white text. */
  background: string;
  /** Primary text colour with ≥ 4.5:1 contrast on `background`. */
  text: string;
  /** Secondary text colour with ≥ 4.5:1 contrast on `background`. */
  mutedText: string;
  /** Header gradient: cover colour fading into the app background. */
  gradient: string;
}

export const APP_BACKGROUND: RGB = [18, 18, 18];

export const DEFAULT_THEME: CoverTheme = buildTheme([64, 64, 64]);

/** Builds a theme from the cover colour. Always derived fresh – never cached in localStorage. */
export function buildTheme(cover: RGB): CoverTheme {
  // Darken the cover colour until white text reaches 4.5:1 (the app is a dark UI), so a bright
  // yellow cover still yields a readable header instead of low-contrast text.
  let bg: RGB = cover;
  for (let i = 0; i < 12 && contrastRatio([255, 255, 255], bg) < 4.5; i++) {
    bg = mix(bg, [0, 0, 0], 0.12);
  }
  const text = readableTextColor(bg);
  const textRgb = parseColor(text) as RGB;
  const muted = ensureContrast(mix(textRgb, bg, 0.3), bg, 4.5);
  const bgHex = toHex(bg);
  return {
    background: bgHex,
    text,
    mutedText: toHex(muted),
    gradient: `linear-gradient(180deg, ${bgHex} 0%, ${toHex(mix(bg, APP_BACKGROUND, 0.7))} 55%, ${toHex(APP_BACKGROUND)} 100%)`,
  };
}
