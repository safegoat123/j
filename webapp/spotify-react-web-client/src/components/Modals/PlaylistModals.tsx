import { useState } from 'react';
import { App as AntApp, Button, Input, Modal, Space } from 'antd';
import { useNavigate } from 'react-router-dom';
import { useAppDispatch, useAppSelector } from '../../store/store';
import { uiActions } from '../../store/slices/ui';
import { errorMessage, useAddToPlaylistMutation, useCreatePlaylistMutation, usePlaylistsQuery } from '../../store/api';

export function PlaylistModals() {
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { message } = AntApp.useApp();
  const pickerIds = useAppSelector((s) => s.ui.playlistPickerTrackIds);
  const createOpen = useAppSelector((s) => s.ui.createPlaylistOpen);
  const { data: playlists = [] } = usePlaylistsQuery();
  const [create, { isLoading: creating }] = useCreatePlaylistMutation();
  const [add] = useAddToPlaylistMutation();
  const [name, setName] = useState('');

  const addTo = async (id: number, title: string) => {
    if (!pickerIds?.length) return;
    try { await add({ id, track_ids: pickerIds }).unwrap(); message.success(`'${title}'에 추가했습니다`); dispatch(uiActions.closePlaylistPicker()); }
    catch (e) { message.error(errorMessage(e)); }
  };
  const submitCreate = async () => {
    const n = name.trim(); if (!n) return;
    try {
      const p = await create({ name: n }).unwrap(); setName('');
      if (pickerIds?.length) await addTo(p.id, p.name);
      else { dispatch(uiActions.closeCreatePlaylist()); navigate(`/playlist/${p.id}`); }
    } catch (e) { message.error(errorMessage(e)); }
  };
  return <>
    <Modal title="재생목록에 추가" open={!!pickerIds} footer={null} onCancel={() => dispatch(uiActions.closePlaylistPicker())}>
      {playlists.length === 0 ? <p className="muted">재생목록이 없습니다. 아래에서 만들어 주세요.</p> :
        <ul className="picker">{playlists.map((p) => <li key={p.id}><button type="button" className="list-btn" onClick={() => addTo(p.id, p.name)}>{p.name} <span className="muted">· {p.track_count}곡</span></button></li>)}</ul>}
      <Space.Compact style={{ width: '100%', marginTop: 12 }}>
        <Input placeholder="새 재생목록 이름" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} onPressEnter={submitCreate} />
        <Button type="primary" loading={creating} disabled={!name.trim()} onClick={submitCreate}>만들고 추가</Button>
      </Space.Compact>
    </Modal>
    <Modal title="새 재생목록" open={createOpen} okText="만들기" cancelText="취소" confirmLoading={creating}
      okButtonProps={{ disabled: !name.trim() }} onOk={submitCreate} onCancel={() => dispatch(uiActions.closeCreatePlaylist())}>
      <Input autoFocus placeholder="이름" value={name} maxLength={200} onChange={(e) => setName(e.target.value)} onPressEnter={submitCreate} />
    </Modal>
  </>;
}
