export type RGB = [number, number, number];

export function parseColor(c: string): RGB | null {
  const m = c.match(/rgba?\(\s*(\d+)\s*[, ]\s*(\d+)\s*[, ]\s*(\d+)/);
  if (m) return [+m[1], +m[2], +m[3]];
  let h = c.trim().replace('#', '');
  if (h.length === 3) h = h.split('').map((x) => x + x).join('');
  if (!/^[0-9a-f]{6}$/i.test(h)) return null;
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16)) as RGB;
}
const luminance = ([r, g, b]: RGB) => {
  const [R, G, B] = [r, g, b].map((v) => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; });
  return 0.2126 * R + 0.7152 * G + 0.0722 * B;
};
/** 배경색 위에서 WCAG 대비가 더 높은 글자색 */
export function textColorFor(bg: string): '#000000' | '#ffffff' {
  const rgb = parseColor(bg);
  if (!rgb) return '#ffffff';
  const L = luminance(rgb);
  return 1.05 / (L + 0.05) > (L + 0.05) / 0.05 ? '#ffffff' : '#000000';
}
/** 너무 밝은 대표색은 어두운 배경 UI에서 눈부시므로 명도를 낮춘다 */
export function toDarkBackground(rgb: RGB, maxLum = 0.12): string {
  const L = luminance(rgb);
  const f = L > maxLum ? Math.sqrt(maxLum / L) : 1;
  return `rgb(${rgb.map((v) => Math.round(v * f)).join(', ')})`;
}
