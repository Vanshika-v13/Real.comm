import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';
import socketService from '../services/socketService';
import { useNavigate } from 'react-router-dom';
import { normalizeRoomCode } from '../utils/roomId';
import {
  dedupeParticipants,
  logParticipantDedupe,
  upsertParticipant,
  findDuplicateParticipants,
} from '../utils/participants';

const RoomContext = createContext();

export const useRoom = () => useContext(RoomContext);

export const RoomProvider = ({ children }) => {
  const [currentRoom, setCurrentRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();

  const syncActiveUsers = useCallback((nextParticipants) => {
    const deduped = dedupeParticipants(nextParticipants);
    setCurrentRoom((room) => {
      if (!room) return room;
      return { ...room, activeUsers: deduped };
    });
    return deduped;
  }, []);

  const handleUserJoined = useCallback((data) => {
    const socket = socketService.getSocket();
    if (!socket || !data?.socketId || data.socketId === socket.id) return;

    setParticipants((prev) => {
      const next = upsertParticipant(prev, {
        userId: data.userId,
        name: data.name,
        socketId: data.socketId,
      });
      logParticipantDedupe('user-joined', prev.length, next.length, { socketId: data.socketId });
      if (import.meta.env.DEV) {
        const dupes = findDuplicateParticipants(next);
        if (dupes.length > 0) {
          console.warn('[RTC:participants] Duplicates after user-joined', dupes, next);
        }
        console.log('[RTC:participants] Upserted', data.socketId, data.name, 'count=', next.length);
      }
      syncActiveUsers(next);
      return next;
    });
  }, [syncActiveUsers]);

  const handleUserLeft = useCallback((data) => {
    setParticipants((prev) => {
      const next = dedupeParticipants(
        prev.filter((p) => {
          if (data.socketId && p.socketId === data.socketId) return false;
          if (data.userId && p.userId === data.userId) return false;
          return true;
        }),
      );
      if (import.meta.env.DEV && next.length !== prev.length) {
        console.log('[RTC:participants] Removed', data.socketId || data.userId, 'count=', next.length);
      }
      syncActiveUsers(next);
      return next;
    });
  }, [syncActiveUsers]);

  const roomHandlersRef = useRef({ handleUserJoined, handleUserLeft });
  useEffect(() => {
    roomHandlersRef.current = { handleUserJoined, handleUserLeft };
  }, [handleUserJoined, handleUserLeft]);

  useEffect(() => {
    const socket = socketService.getSocket() || socketService.connect();
    if (!socket) return undefined;

    const onUserJoined = (data) => roomHandlersRef.current.handleUserJoined(data);
    const onUserLeft = (data) => roomHandlersRef.current.handleUserLeft(data);

    socket.on('user-joined', onUserJoined);
    socket.on('user-left', onUserLeft);

    if (import.meta.env.DEV) {
      console.log('[RTC:participants] Room socket listeners registered');
    }

    return () => {
      socket.off('user-joined', onUserJoined);
      socket.off('user-left', onUserLeft);
      if (import.meta.env.DEV) {
        console.log('[RTC:participants] Room socket listeners removed');
      }
    };
  }, []);

  const joinRoom = useCallback(
    (roomId, options = {}) => {
      const { navigateToRoom = true } = options;
      const normalizedId = normalizeRoomCode(roomId);

      if (!normalizedId) {
        setError('Invalid room code');
        return Promise.resolve(false);
      }

      setLoading(true);
      setError(null);

      return new Promise((resolve) => {
        try {
          const socket = socketService.getSocket() || socketService.connect();
          if (!socket) {
            setError('Not connected to server');
            setLoading(false);
            resolve(false);
            return;
          }

          socket.emit('join-room', { roomId: normalizedId }, (response) => {
            if (response?.ok) {
              const activeUsers = dedupeParticipants(response.activeUsers || []);
              logParticipantDedupe('join-room', (response.activeUsers || []).length, activeUsers.length, {
                roomId: response.roomId,
              });
              if (import.meta.env.DEV) {
                const dupes = findDuplicateParticipants(response.activeUsers || []);
                if (dupes.length > 0) {
                  console.warn('[RTC:participants] Raw join-room duplicates', dupes);
                }
                console.log('[RTC:participants] join-room set', activeUsers.length, activeUsers);
              }
              setParticipants(activeUsers);
              setCurrentRoom({
                roomId: response.roomId,
                activeUsers,
              });

              if (navigateToRoom) {
                navigate(`/room/${response.roomId}`);
              }
              resolve(true);
            } else {
              setError(response?.message || 'Could not join room');
              resolve(false);
            }
            setLoading(false);
          });
        } catch {
          setError('Failed to connect to room');
          setLoading(false);
          resolve(false);
        }
      });
    },
    [navigate],
  );

  const createRoom = async (roomData) => {
    setLoading(true);
    setError(null);
    try {
      const response = await api.post('/rooms/create', roomData);
      const roomId = response.data?.data?.room?.roomId;
      if (!roomId) {
        setError('Failed to create room');
        setLoading(false);
        return false;
      }
      return joinRoom(roomId);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create room');
      setLoading(false);
      return false;
    }
  };

  const leaveRoom = () => {
    if (currentRoom) {
      const socket = socketService.getSocket();
      if (socket) {
        socket.emit('leave-room', { roomId: currentRoom.roomId });
      }
      setCurrentRoom(null);
      setParticipants([]);
      navigate('/dashboard');
    }
  };

  return (
    <RoomContext.Provider
      value={{
        currentRoom,
        participants,
        loading,
        error,
        joinRoom,
        createRoom,
        leaveRoom,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
