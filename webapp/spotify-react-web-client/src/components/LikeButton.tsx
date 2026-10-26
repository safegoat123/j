import { memo } from 'react';
import { App as AntApp } from 'antd';
import { FaHeart, FaRegHeart } from 'react-icons/fa';
import { errorMessage, useSetLikedMutation } from '../store/api';

export const LikeButton = memo(({ trackId, liked }: { trackId: number; liked: boolean }) => {
  const [setLiked, { isLoading }] = useSetLikedMutation();
  const { message } = AntApp.useApp();
  return (
    <button type="button" className={`icon-btn${liked ? ' is-active' : ''}`} aria-pressed={liked}
      aria-label={liked ? '좋아요 취소' : '좋아요'} disabled={isLoading}
      onClick={(e) => {
        e.stopPropagation();
        setLiked({ id: trackId, liked: !liked }).unwrap().catch((err) => message.error(errorMessage(err)));
      }}>
      {liked ? <FaHeart /> : <FaRegHeart />}
    </button>
  );
});
LikeButton.displayName = 'LikeButton';
