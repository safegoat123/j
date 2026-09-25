export interface MusicSearchResult {
  name: string;
  artist: string;
  title: string;
  audioBuffer: Buffer;
  previewUrl: string;
}

/**
 * 곡명이나 아티스트명 텍스트로 고음질 공식 프리뷰 음원을 검색하여 다운로드합니다.
 * (한국, 일본, 글로벌 스토어 순차 검색)
 */
export async function searchAndDownloadMusic(query: string): Promise<MusicSearchResult | null> {
  const cleanQuery = query.replace(/[#@]/g, "").trim();
  if (!cleanQuery) return null;

  for (const country of ["KR", "JP", "US"]) {
    try {
      const url = `https://itunes.apple.com/search?term=${encodeURIComponent(
        cleanQuery
      )}&entity=song&limit=5&country=${country}`;
      const res = await fetch(url, {
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        },
      });
      if (!res.ok) continue;

      const data: any = await res.json();
      const track = data.results?.find((r: any) => r.previewUrl);
      if (track?.previewUrl) {
        const audioRes = await fetch(track.previewUrl);
        if (audioRes.ok) {
          const arrayBuffer = await audioRes.arrayBuffer();
          const audioBuffer = Buffer.from(arrayBuffer);
          const artist = track.artistName || "Unknown Artist";
          const title = track.trackName || cleanQuery;
          return {
            name: `${artist} - ${title}`,
            artist,
            title,
            audioBuffer,
            previewUrl: track.previewUrl,
          };
        }
      }
    } catch (err: any) {
      console.warn(`[Music Search Error (${country})]:`, err.message);
    }
  }

  return null;
}
