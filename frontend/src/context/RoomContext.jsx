import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import api from '../api/axios';
import socketService from '../services/socketService';
import { useNavigate } from 'react-router-dom';
import { useAuth } from './AuthContext';
import { normalizeRoomCode } from '../utils/roomId';
import {
  dedupeParticipants,
  logParticipantDedupe,
  upsertParticipant,
  findDuplicateParticipants,
} from '../utils/participants';
import {
  markRecentRoomInactive,
  resolveRoomDisplayName,
  upsertRecentRoom,
} from '../utils/recentRoomsStorage';
import {
  writeRoomSession,
  clearRoomSession,
  readRoomSession,
  writePrejoinPrefs,
  readPrejoinPrefs,
} from '../utils/roomSessionStorage';

const RoomContext = createContext();

export const useRoom = () => useContext(RoomContext);

export const RoomProvider = ({ children }) => {
  const { user } = useAuth();
  const [currentRoom, setCurrentRoom] = useState(null);
  const [participants, setParticipants] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Join Approval States
  const [isPendingApproval, setIsPendingApproval] = useState(false);
  const [pendingRoomId, setPendingRoomId] = useState(null);
  const [joinRequests, setJoinRequests] = useState([]);

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
        profileImage: data.profileImage,
        fullName: data.fullName,
        username: data.username,
        bio: data.bio,
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

  const handleJoinRequest = useCallback((data) => {
    // data: { roomId, userId, user, socketId, requestedAt }
    if (import.meta.env.DEV) {
      console.log('[RTC:approval] join-request received', data);
    }
    const normalized = {
      ...data,
      userId: data.userId || data.user?.userId || data.user?.id,
    };
    setJoinRequests((prev) => {
      if (prev.some((req) => req.socketId === normalized.socketId)) return prev;
      return [...prev, normalized];
    });
  }, []);

  const handleJoinApproved = useCallback((data) => {
    // data: { roomId, message, activeUsers }
    const activeUsers = dedupeParticipants(data.activeUsers || []);
    setParticipants(activeUsers);
    setCurrentRoom({
      roomId: data.roomId,
      activeUsers,
    });
    
    if (user) {
      upsertRecentRoom(user, {
        roomId: data.roomId,
        roomName: resolveRoomDisplayName(data, data.name),
        role: 'joiner',
        joinedAt: new Date().toISOString(),
        isActive: true,
      });
    }

    setIsPendingApproval(false);
    setPendingRoomId(null);
    const prior = readRoomSession(data.roomId) || readPrejoinPrefs(data.roomId);
    writeRoomSession(data.roomId, {
      micOn: prior?.micOn ?? false,
      cameraOn: prior?.cameraOn ?? false,
    });
    navigate(`/room/${data.roomId}`);
  }, [navigate, user]);

  const handleJoinRejected = useCallback((data) => {
    // data: { roomId, message }
    setIsPendingApproval(false);
    setPendingRoomId(null);
    setError(data.message || 'Request to join was rejected by host');
    navigate('/dashboard');
  }, [navigate]);

  const handleRoomSessionClosed = useCallback((data) => {
    const roomId = data.roomId || currentRoom?.roomId;
    if (user && roomId) {
      markRecentRoomInactive(user, roomId);
    }
    if (roomId) {
      clearRoomSession(roomId);
    }

    setCurrentRoom(null);
    setParticipants([]);
    setError(data?.reason || 'The host has left the meeting.');
    navigate('/dashboard');
  }, [user, currentRoom, navigate]);

  const handleUserProfileUpdated = useCallback((data) => {
    // data: { userId, name, fullName, username, profileImage, bio }
    setParticipants((prev) => {
      const next = prev.map((p) => {
        if (p.userId === data.userId) {
          return {
            ...p,
            name: data.fullName || data.name || p.name,
            fullName: data.fullName || p.fullName,
            username: data.username || p.username,
            profileImage: data.profileImage || p.profileImage,
            bio: data.bio || p.bio,
          };
        }
        return p;
      });
      syncActiveUsers(next);
      return next;
    });
  }, [syncActiveUsers]);

  const roomHandlersRef = useRef({
    handleUserJoined,
    handleUserLeft,
    handleJoinRequest,
    handleJoinApproved,
    handleJoinRejected,
    handleUserProfileUpdated,
    handleRoomSessionClosed
  });

  useEffect(() => {
    roomHandlersRef.current = {
      handleUserJoined,
      handleUserLeft,
      handleJoinRequest,
      handleJoinApproved,
      handleJoinRejected,
      handleUserProfileUpdated,
      handleRoomSessionClosed
    };
  }, [
    handleUserJoined,
    handleUserLeft,
    handleJoinRequest,
    handleJoinApproved,
    handleJoinRejected,
    handleUserProfileUpdated,
    handleRoomSessionClosed
  ]);

  const [activeSocket, setActiveSocket] = useState(() => socketService.getSocket());
  const [socketVersion, setSocketVersion] = useState(0);

  useEffect(() => {
    const handleSocketChange = (sock) => {
      setActiveSocket(sock);
      setSocketVersion((v) => v + 1);
    };

    const unsubscribe = socketService.subscribe(handleSocketChange);

    const socket = socketService.getSocket() || socketService.connect();
    if (socket) {
      setActiveSocket(socket);
    }

    return () => {
      unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!activeSocket) {
      if (import.meta.env.DEV) {
        console.log('[RTC:approval] No active socket — listeners not registered');
      }
      return undefined;
    }

    const onUserJoined = (data) => roomHandlersRef.current.handleUserJoined(data);
    const onUserLeft = (data) => roomHandlersRef.current.handleUserLeft(data);
    const onJoinRequest = (data) => roomHandlersRef.current.handleJoinRequest(data);
    const onJoinApproved = (data) => roomHandlersRef.current.handleJoinApproved(data);
    const onJoinRejected = (data) => roomHandlersRef.current.handleJoinRejected(data);
    const onUserProfileUpdated = (data) => roomHandlersRef.current.handleUserProfileUpdated(data);
    const onRoomSessionClosed = (data) => roomHandlersRef.current.handleRoomSessionClosed(data);

    activeSocket.on('user-joined', onUserJoined);
    activeSocket.on('user-left', onUserLeft);
    activeSocket.on('join-request', onJoinRequest);
    activeSocket.on('join-approved', onJoinApproved);
    activeSocket.on('join-rejected', onJoinRejected);
    activeSocket.on('user-profile-updated', onUserProfileUpdated);
    activeSocket.on('room-session-closed', onRoomSessionClosed);

    if (import.meta.env.DEV) {
      console.log('[RTC:approval] Socket listeners registered', { socketId: activeSocket.id, socketVersion });
    }

    return () => {
      activeSocket.off('user-joined', onUserJoined);
      activeSocket.off('user-left', onUserLeft);
      activeSocket.off('join-request', onJoinRequest);
      activeSocket.off('join-approved', onJoinApproved);
      activeSocket.off('join-rejected', onJoinRejected);
      activeSocket.off('user-profile-updated', onUserProfileUpdated);
      activeSocket.off('room-session-closed', onRoomSessionClosed);
      if (import.meta.env.DEV) {
        console.log('[RTC:approval] Socket listeners cleaned up', { socketId: activeSocket.id });
      }
    };
  }, [activeSocket, socketVersion]);

  const approveJoinRequest = useCallback((roomId, userId, socketId) => {
    return new Promise((resolve) => {
      const socket = socketService.getSocket();
      if (!socket) return resolve(false);
      socket.emit('approve-join-request', { roomId, userId, socketId }, (res) => {
        if (res?.ok || res?.message?.includes('no longer connected') || res?.message?.includes('not found')) {
          setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
        }
        resolve(!!res?.ok);
      });
    });
  }, []);

  const rejectJoinRequest = useCallback((roomId, userId, socketId, reason) => {
    return new Promise((resolve) => {
      const socket = socketService.getSocket();
      if (!socket) return resolve(false);
      socket.emit('reject-join-request', { roomId, userId, socketId, message: reason }, (res) => {
        if (res?.ok || res?.message?.includes('not found')) {
          setJoinRequests((prev) => prev.filter((r) => r.socketId !== socketId));
        }
        resolve(!!res?.ok);
      });
    });
  }, []);

  const cancelJoinRequest = useCallback(() => {
    setIsPendingApproval(false);
    setPendingRoomId(null);
    navigate('/dashboard');
  }, [navigate]);

  const joinRoom = useCallback(
    (roomId, options = {}) => {
      const { navigateToRoom = true, micOn = false, cameraOn = false } = options;
      const normalizedId = normalizeRoomCode(roomId);

      if (!normalizedId) {
        setError('Invalid room code');
        return Promise.resolve('failed');
      }

      setLoading(true);
      setError(null);

      return new Promise((resolve) => {
        try {
          const socket = socketService.getSocket() || socketService.connect();
          if (!socket) {
            setError('Not connected to server');
            setLoading(false);
            resolve('failed');
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
              setIsPendingApproval(false);
              setPendingRoomId(null);
              writeRoomSession(response.roomId, { micOn, cameraOn });

              if (navigateToRoom) {
                navigate(`/room/${response.roomId}`);
              }
              resolve('joined');
            } else if (response?.pending) {
              writePrejoinPrefs(normalizedId, { micOn, cameraOn });
              setIsPendingApproval(true);
              setPendingRoomId(normalizedId);
              resolve('pending');
            } else {
              setError(response?.message || 'Could not join room');
              resolve('failed');
            }
            setLoading(false);
          });
        } catch {
          setError('Failed to connect to room');
          setLoading(false);
          resolve('failed');
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
      const createdRoom = response.data?.data?.room;
      const roomId = createdRoom?.roomId;
      if (!roomId) {
        setError('Failed to create room');
        setLoading(false);
        return false;
      }

      if (user) {
        upsertRecentRoom(user, {
          roomId,
          roomName: resolveRoomDisplayName(createdRoom, roomData?.name),
          role: 'host',
          joinedAt: new Date().toISOString(),
          isActive: true,
        });
      }

      const result = await joinRoom(roomId);
      setLoading(false);
      return result === 'joined' || result === 'pending';
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

      if (user) {
        markRecentRoomInactive(user, currentRoom.roomId);
      }
      clearRoomSession(currentRoom.roomId);

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
        isPendingApproval,
        pendingRoomId,
        joinRequests,
        setJoinRequests,
        approveJoinRequest,
        rejectJoinRequest,
        cancelJoinRequest,
      }}
    >
      {children}
    </RoomContext.Provider>
  );
};
