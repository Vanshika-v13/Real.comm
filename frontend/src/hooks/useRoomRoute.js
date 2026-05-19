import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { normalizeRoomCode } from '../utils/roomId';

/**
 * Ensures the user is joined to the room in the URL (direct links / refresh).
 */
export const useRoomRoute = () => {
  const { roomId: paramRoomId } = useParams();
  const roomId = normalizeRoomCode(paramRoomId);
  const { currentRoom, joinRoom, loading } = useRoom();
  const [failed, setFailed] = useState(false);
  const joiningRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;
    if (currentRoom?.roomId === roomId) {
      setFailed(false);
      joiningRef.current = false;
      return;
    }
    if (joiningRef.current) return;

    joiningRef.current = true;
    setFailed(false);
    joinRoom(roomId).then((ok) => {
      joiningRef.current = false;
      if (!ok) setFailed(true);
    });
  }, [roomId, currentRoom?.roomId, joinRoom]);

  const isReady = currentRoom?.roomId === roomId;
  const isJoining = !isReady && (loading || joiningRef.current) && !failed;

  return { roomId, isReady, isJoining, failed };
};
