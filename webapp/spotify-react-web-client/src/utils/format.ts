const pad = (n: number) => String(n).padStart(2, '0');

export const formatTime = (sec?: number | null): string => {
  if (sec == null || !Number.isFinite(sec) || sec < 0) return '0:00';
  const s = Math.floor(sec);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h ? `${h}:${pad(m)}:${pad(s % 60)}` : `${m}:${pad(s % 60)}`;
};

export const formatTotal = (sec: number): string => {
  const m = Math.round(sec / 60);
  return m >= 60 ? `${Math.floor(m / 60)}시간 ${m % 60}분` : `${m}분`;
};

export const firstPlayable = (tracks: { playable: boolean }[]): number =>
  tracks.findIndex((t) => t.playable);
