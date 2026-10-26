import { useState } from 'react';
import { Input, Spin, Tabs, Alert } from 'antd';
import { useSearchQuery, errorMessage } from '../../store/api';
import { TrackList } from '../../components/TrackList';
import { AlbumCard, ArtistCard, CardGrid } from '../../components/Cards';

export default function SearchPage() {
  const [q, setQ] = useState('');
  const { data, error, isFetching } = useSearchQuery(q.trim(), { skip: q.trim().length === 0 });
  return <div className="page"><h1>검색</h1>
    <Input.Search size="large" placeholder="곡, 앨범, 아티스트 검색" value={q} onChange={(e) => setQ(e.target.value)} allowClear />
    {isFetching && <div className="page-loading"><Spin /></div>}
    {error && <Alert style={{ marginTop: 16 }} type="error" message={errorMessage(error)} />}
    {data && <Tabs style={{ marginTop: 20 }} items={[
      { key: 'tracks', label: `곡 ${data.tracks.length}`, children: <TrackList tracks={data.tracks} /> },
      { key: 'albums', label: `앨범 ${data.albums.length}`, children: <CardGrid>{data.albums.map((a) => <AlbumCard key={a.key} album={a} />)}</CardGrid> },
      { key: 'artists', label: `아티스트 ${data.artists.length}`, children: <CardGrid>{data.artists.map((a) => <ArtistCard key={a.key} artist={a} />)}</CardGrid> },
    ]} />}
  </div>;
}
