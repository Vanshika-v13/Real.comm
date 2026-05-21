import React, { useEffect, useState, useMemo, useRef, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
import PreJoinScreen from '../components/PreJoinScreen';
import { readRoomSession, patchRoomSession } from '../utils/roomSessionStorage';
import { useWebRTC } from '../hooks/useWebRTC';
import { useVoiceActivity } from '../hooks/useVoiceActivity';
import { useFiles } from '../hooks/useFiles';
import { useToast } from '../context/ToastContext';
import ParticipantSidebar from '../components/ParticipantSidebar';
import RoomControls from '../components/RoomControls';
import VideoFeed from '../components/VideoFeed';
import ScreenShareView from '../components/ScreenShareView';
import Whiteboard from '../components/Whiteboard';
import FilePanel from '../components/FilePanel';
import ChatPanel from '../components/ChatPanel';
import { motion, AnimatePresence } from 'framer-motion';
import { FiCopy, FiLayout, FiFolder, FiUserCheck, FiXCircle, FiUsers } from 'react-icons/fi';
import socketService from '../services/socketService';
import { dedupeParticipants } from '../utils/participants';
import api from '../api/axios';
import { resolveRoomDisplayName, upsertRecentRoom } from '../utils/recentRoomsStorage';


const RoomMeetingView = ({ roomId, initialMicOn, initialVideoOn }) => {
  const { currentRoom, participants, joinRequests, approveJoinRequest, rejectJoinRequest } = useRoom();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [showParticipants, setShowParticipants] = useState(false);
  const [chatMessages, setChatMessages] = useState([]);
  const [unreadChat, setUnreadChat] = useState(0);
  const [raisedHands, setRaisedHands] = useState([]);
  const [isHandRaised, setIsHandRaised] = useState(false);
  const [reactionsBySocket, setReactionsBySocket] = useState({});
  const [isHost, setIsHost] = useState(false);
  const [inviteLink, setInviteLink] = useState('');
  const [roomSocket, setRoomSocket] = useState(() => socketService.getSocket());
  const showChatRef = useRef(showChat);
  showChatRef.current = showChat;

  const {
    localStream,
    screenStream,
    remoteStreams,
    remoteScreenStreams,
    presenter,
    peerNames,
    peerMediaState,
    isMicOn,
    isVideoOn,
    localMediaRevision,
    toggleMic,
    toggleVideo,
    startConferencing,
    startScreenShare,
    stopScreenShare,
  } = useWebRTC(roomId, initialMicOn, initialVideoOn);

  const startConferencingRef = useRef(startConferencing);
  useEffect(() => {
    startConferencingRef.current = startConferencing;
  }, [startConferencing]);

  const { level: localAudioLevel, isSpeaking: localSpeaking } = useVoiceActivity(localStream, isMicOn);

  const { files, isUploading, uploadProgress, uploadFile, downloadFile } = useFiles(roomId);

  useEffect(() => {
    if (!roomId) return;
    setInviteLink(`${window.location.origin}/room/${roomId}`);
  }, [roomId]);

  useEffect(() => {
    return socketService.subscribe((sock) => setRoomSocket(sock));
  }, []);

  useEffect(() => {
    const socket = roomSocket;
    if (!socket || !roomId) return undefined;

    socket.emit('get-chat-history', { roomId });
    socket.emit('get-raised-hands', { roomId });

    const onChatHistory = (history) => {
      if (!Array.isArray(history)) return;
      setChatMessages(history);
      const session = readRoomSession(roomId);
      const lastReadMs = session?.lastReadChatAt
        ? new Date(session.lastReadChatAt).getTime()
        : 0;
      if (lastReadMs > 0) {
        const unread = history.filter((m) => {
          const msgTime = new Date(m.createdAt || m.timestamp || 0).getTime();
          return msgTime > lastReadMs && m.sender?.userId !== user?.id;
        }).length;
        setUnreadChat(unread);
        patchRoomSession(roomId, { unreadChat: unread });
      } else if (typeof session?.unreadChat === 'number' && session.unreadChat > 0) {
        setUnreadChat(session.unreadChat);
      }
    };

    const onReceiveMessage = (message) => {
      if (!message?.id) return;
      setChatMessages((prev) => {
        if (prev.some((m) => m.id === message.id)) return prev;
        return [...prev, message];
      });
      const isOwn = message.sender?.userId === user?.id;
      if (!showChatRef.current && !isOwn) {
        setUnreadChat((count) => {
          const next = count + 1;
          patchRoomSession(roomId, { unreadChat: next });
          return next;
        });
      }
    };

    const onRaisedHandsList = (list) => {
      const hands = Array.isArray(list) ? list : [];
      setRaisedHands(hands);
      setIsHandRaised(hands.some((h) => h.socketId === socket.id));
    };

    const onHandStateChanged = (data) => {
      if (!data?.socketId) return;
      if (data.raised) {
        setRaisedHands((prev) => {
          if (prev.some((h) => h.socketId === data.socketId)) return prev;
          return [
            ...prev,
            {
              socketId: data.socketId,
              userId: data.userId,
              name: data.name,
              timestamp: data.timestamp,
            },
          ];
        });
        if (data.socketId === socket.id) {
          setIsHandRaised(true);
        }
      } else {
        setRaisedHands((prev) => prev.filter((h) => h.socketId !== data.socketId));
        if (data.socketId === socket.id) {
          setIsHandRaised(false);
        }
      }
    };

    const onReceiveReaction = (data) => {
      if (!data?.socketId || !data?.emoji) return;
      const reactionId = data.reactionId || `react-${data.socketId}-${Date.now()}`;
      const payload = { ...data, id: reactionId };
      setReactionsBySocket((prev) => ({
        ...prev,
        [data.socketId]: payload,
      }));
      setTimeout(() => {
        setReactionsBySocket((prev) => {
          if (prev[data.socketId]?.id !== reactionId) return prev;
          const next = { ...prev };
          delete next[data.socketId];
          return next;
        });
      }, 2500);
    };

    socket.on('chat-history', onChatHistory);
    socket.on('receive-message', onReceiveMessage);
    socket.on('raised-hands-list', onRaisedHandsList);
    socket.on('hand-state-changed', onHandStateChanged);
    socket.on('receive-reaction', onReceiveReaction);

    return () => {
      socket.off('chat-history', onChatHistory);
      socket.off('receive-message', onReceiveMessage);
      socket.off('raised-hands-list', onRaisedHandsList);
      socket.off('hand-state-changed', onHandStateChanged);
      socket.off('receive-reaction', onReceiveReaction);
    };
  }, [roomSocket, roomId, user?.id]);

  const handleSendChatMessage = useCallback((text) => {
    const socket = roomSocket || socketService.getSocket();
    if (!socket || !roomId) return;
    socket.emit('send-message', { roomId, text }, (res) => {
      if (!res?.ok) {
        toast(res?.message || 'Failed to send message', 'error');
      }
    });
  }, [roomSocket, roomId, toast]);

  const handleToggleHand = useCallback(() => {
    const socket = roomSocket || socketService.getSocket();
    if (!socket || !roomId) return;
    const event = isHandRaised ? 'lower-hand' : 'raise-hand';
    socket.emit(event, { roomId }, (res) => {
      if (res?.ok) {
        setIsHandRaised(!isHandRaised);
      } else {
        toast(res?.message || 'Hand raise failed', 'error');
      }
    });
  }, [roomSocket, roomId, isHandRaised, toast]);

  const handleLowerHand = useCallback((targetSocketId) => {
    const socket = roomSocket || socketService.getSocket();
    if (!socket || !roomId || !targetSocketId) return;
    socket.emit('lower-hand', { roomId, targetSocketId }, (res) => {
      if (!res?.ok) {
        toast(res?.message || 'Could not lower hand', 'error');
      }
    });
  }, [roomSocket, roomId, toast]);

  const handleSendReaction = useCallback((emoji) => {
    const socket = roomSocket || socketService.getSocket();
    if (!socket || !roomId) return;
    socket.emit('send-reaction', { roomId, emoji }, (res) => {
      if (!res?.ok) {
        toast(res?.message || 'Could not send reaction', 'error');
      }
    });
  }, [roomSocket, roomId, toast]);

  const handleToggleChat = useCallback(() => {
    setShowChat((open) => {
      if (!open) {
        setUnreadChat(0);
        patchRoomSession(roomId, { unreadChat: 0, lastReadChatAt: new Date().toISOString() });
      }
      return !open;
    });
  }, [roomId]);

  useEffect(() => {
    if (!roomId) return;
    const session = readRoomSession(roomId);
    if (typeof session?.unreadChat === 'number' && session.unreadChat > 0) {
      setUnreadChat(session.unreadChat);
    }
  }, [roomId]);

  const handleFileUpload = useCallback(async (file) => {
    try {
      await uploadFile(file);
      toast('File shared with room', 'success');
    } catch {
      toast('File upload failed', 'error');
    }
  }, [uploadFile, toast]);

  useEffect(() => {
    if (!roomId) return;

    const localSocketId = socketService.getSocket()?.id;
    const peerList = dedupeParticipants(participants);
    const remoteOnly = peerList.filter((p) => p.socketId && p.socketId !== localSocketId);

    if (!remoteOnly.length) {
      if (import.meta.env.DEV) {
        console.log('[RTC:participants] No remote peers — skipping startConferencing');
      }
      return;
    }

    if (import.meta.env.DEV) {
      const key = remoteOnly.map((p) => p.socketId).sort().join('|');
      console.log('[RTC:participants] startConferencing', { peers: remoteOnly.length, key });
    }
    // startConferencing has its own idempotency guard (conferencingSession) including a
    // peer-liveness check, so it is safe to call on every participants change.
    startConferencingRef.current(remoteOnly);
  }, [participants, roomId]);

  // Fetch room details on mount/join & record in history
  useEffect(() => {
    if (!roomId || !currentRoom || currentRoom.roomId !== roomId || !user) return;

    api.get(`/rooms/${roomId}`)
      .then((res) => {
        const roomData = res.data?.data?.room;
        if (roomData) {
          const host =
            roomData.createdBy?.id === user.id
            || roomData.createdBy?._id === user._id
            || roomData.createdBy === user.id
            || roomData.createdBy === user._id;
          setIsHost(host);
          const hostName = roomData.createdBy?.fullName || roomData.createdBy?.name || 'User';
          const roomName = resolveRoomDisplayName(roomData);

          upsertRecentRoom(user, {
            roomId: roomData.roomId,
            roomName,
            joinedAt: new Date().toISOString(),
            hostName,
            role: host ? 'host' : 'joiner',
            isActive: roomData.isActive ?? true,
          });
        }
      })
      .catch((err) => {
        console.error('Error fetching room host info:', err);
      });
  }, [roomId, currentRoom, user]);

  const remotePeers = useMemo(() => {
    const localSocketId = socketService.getSocket()?.id;
    const remoteParticipants = dedupeParticipants(participants).filter(
      (p) => p.socketId && p.socketId !== localSocketId,
    );

    const byUser = new Map();
    remoteParticipants.forEach((p) => {
      const socketId = p.socketId;
      const entry = {
        socketId,
        userId: p.userId,
        name: peerNames[socketId] || p.name || 'Participant',
        stream: remoteStreams[socketId] ?? null,
        isMicOn: peerMediaState[socketId]?.isMicOn ?? true,
        isVideoOn: peerMediaState[socketId]?.isVideoOn ?? true,
      };
      const key = p.userId || socketId;
      const existing = byUser.get(key);
      if (!existing || (entry.stream && !existing.stream)) {
        byUser.set(key, entry);
      }
    });

    const peers = [...byUser.values()];
    if (import.meta.env.DEV) {
      const orphanStreams = Object.keys(remoteStreams).filter(
        (id) => id !== localSocketId && !remoteParticipants.some((p) => p.socketId === id),
      );
      if (orphanStreams.length > 0) {
        console.warn('[RTC:participants] Orphan remote streams (not rendered)', orphanStreams);
      }
      const dupCheck = new Set(peers.map((p) => p.socketId));
      if (dupCheck.size !== peers.length) {
        console.warn('[RTC:participants] Duplicate remote peer tiles', peers);
      }
    }
    return peers;
  }, [remoteStreams, participants, peerNames, peerMediaState]);

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomId);
    toast('Room code copied', 'success');
  };

  const copyInviteLink = () => {
    const link = inviteLink || `${window.location.origin}/room/${roomId}`;
    navigator.clipboard.writeText(link);
    toast('Invite link copied', 'success');
  };

  const localSocketId = socketService.getSocket()?.id;

  const isAnySharing = !!presenter;
  const isMeSharing = presenter?.socketId === socketService.getSocket()?.id;
  const activeScreenStream = isMeSharing
    ? screenStream
    : presenter
      ? remoteScreenStreams[presenter.socketId]
      : null;

  const totalVideos = 1 + remotePeers.length;
  
  const getAdaptiveGridClass = (count) => {
    if (count === 1) return 'grid-cols-1';
    if (count === 2) return 'grid-cols-1 sm:grid-cols-2';
    if (count === 3 || count === 4) return 'grid-cols-2 sm:grid-cols-2 lg:grid-cols-2';
    if (count <= 6) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-3';
    if (count <= 8) return 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4';
    return 'grid-cols-3 sm:grid-cols-4 lg:grid-cols-5';
  };

  return (
    <div className="flex h-[100dvh] bg-background text-foreground overflow-hidden w-full relative">
      <motion.div className="flex-1 flex flex-col relative min-w-0 h-full overflow-hidden w-full">
        <AnimatePresence>
          {showWhiteboard && <Whiteboard roomId={roomId} onClose={() => setShowWhiteboard(false)} />}
          {showFilePanel && (
            <FilePanel
              files={files}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onUpload={handleFileUpload}
              onDownload={async (fileId, fileName) => {
                try {
                  const blob = await downloadFile(fileId);
                  const url = URL.createObjectURL(blob);
                  const a = document.createElement('a');
                  a.href = url;
                  a.download = fileName || 'download';
                  a.click();
                  URL.revokeObjectURL(url);
                } catch {
                  toast('Download failed', 'error');
                }
              }}
              onClose={() => setShowFilePanel(false)}
            />
          )}
          {showChat && (
            <ChatPanel
              messages={chatMessages}
              onSendMessage={handleSendChatMessage}
              onClose={() => {
                setShowChat(false);
                setUnreadChat(0);
              }}
              currentUserId={user?.id}
            />
          )}
        </AnimatePresence>

        <header className="h-16 px-4 sm:px-6 flex items-center justify-between bg-slate-950/50 backdrop-blur-md border-b border-white/5 z-20 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 bg-primary rounded flex items-center justify-center font-bold text-white shadow-lg shadow-primary/20 shrink-0">
              R
            </div>
            <div className="min-w-0">
              <h1 className="text-sm font-semibold text-white tracking-tight truncate">Room {roomId}</h1>
              <button
                type="button"
                onClick={copyRoomCode}
                className="flex items-center gap-1.5 text-[10px] text-secondary uppercase tracking-widest font-medium hover:text-primary transition-colors"
              >
                <span className="truncate">Code: {roomId}</span>
                <FiCopy className="w-3 h-3 shrink-0" />
              </button>
              <button
                type="button"
                onClick={copyInviteLink}
                className="flex items-center gap-1.5 text-[10px] text-primary/80 hover:text-primary transition-colors mt-0.5 max-w-[220px] sm:max-w-xs"
                title={inviteLink || `Invite link for room ${roomId}`}
              >
                <span className="truncate">Invite: {inviteLink || `/room/${roomId}`}</span>
                <FiCopy className="w-3 h-3 shrink-0" />
              </button>
            </div>
          </div>

          {isAnySharing && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="hidden sm:flex bg-primary/10 border border-primary/20 px-4 py-1.5 rounded-full items-center gap-2"
            >
              <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
              <span className="text-xs font-semibold text-primary">
                {isMeSharing ? 'You are presenting' : `${presenter.userName} is presenting`}
              </span>
            </motion.div>
          )}

          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => setShowFilePanel(!showFilePanel)}
              className={`p-2.5 rounded-xl transition-all relative ${showFilePanel ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-white hover:bg-white/5'}`}
            >
              <FiFolder size={18} />
              {files.length > 0 && (
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-accent text-[9px] font-bold rounded-full flex items-center justify-center text-white border-2 border-background">
                  {files.length}
                </span>
              )}
            </button>
            <div className="w-px h-6 bg-white/5 hidden sm:block" />
            <button
              type="button"
              onClick={() => setShowParticipants(!showParticipants)}
              className={`lg:hidden p-2.5 rounded-xl transition-all relative ${showParticipants ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-white hover:bg-white/5'}`}
              title="Toggle Participants"
            >
              <FiUsers size={18} />
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary/20 text-[9px] font-bold rounded-full flex items-center justify-center text-primary border-2 border-background">
                {totalVideos}
              </span>
            </button>
          </div>
        </header>

        <div className="flex-1 p-3 sm:p-6 pb-28 sm:pb-32 relative overflow-hidden flex flex-col gap-3 sm:gap-6 min-h-0 max-w-full">
          <AnimatePresence mode="wait">
            {isAnySharing ? (
              <motion.div
                key="presentation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col gap-3 sm:gap-4 min-h-0 max-w-full overflow-hidden"
              >
                <div className="flex-1 min-h-0 max-w-full overflow-hidden">
                  <ScreenShareView
                    stream={activeScreenStream}
                    presenterName={isMeSharing ? 'You' : presenter.userName}
                  />
                </div>
                <div className="max-h-[38vh] sm:max-h-none sm:h-40 flex flex-wrap sm:flex-nowrap gap-2 sm:gap-3 overflow-y-auto sm:overflow-y-hidden overflow-x-hidden sm:overflow-x-auto pb-2 custom-scrollbar shrink-0 w-full">
                  <div className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-[240px] min-w-0 flex-1 sm:flex-none basis-[calc(50%-0.25rem)] sm:basis-auto max-w-full sm:max-w-none">
                    <VideoFeed
                      stream={localStream}
                      name={user?.name}
                      isMe
                      isVideoOn={isVideoOn}
                      isMicOn={isMicOn}
                      mediaRevision={localMediaRevision}
                      isHandRaised={isHandRaised}
                      reaction={localSocketId ? reactionsBySocket[localSocketId] : null}
                    />
                  </div>
                  {remotePeers.map((p) => (
                    <div
                      key={p.socketId}
                      className="w-[calc(50%-0.25rem)] sm:w-auto sm:min-w-[240px] min-w-0 flex-1 sm:flex-none basis-[calc(50%-0.25rem)] sm:basis-auto max-w-full sm:max-w-none"
                    >
                      <VideoFeed
                        stream={p.stream}
                        name={p.name}
                        isVideoOn={p.isVideoOn}
                        isMicOn={p.isMicOn}
                        isHandRaised={raisedHands.some((h) => h.socketId === p.socketId)}
                        reaction={reactionsBySocket[p.socketId]}
                      />
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`grid gap-2 sm:gap-4 h-full min-h-0 place-content-center ${getAdaptiveGridClass(totalVideos)}`}
              >
                <VideoFeed
                  stream={localStream}
                  name={user?.name}
                  isMe
                  isVideoOn={isVideoOn}
                  isMicOn={isMicOn}
                  mediaRevision={localMediaRevision}
                  isHandRaised={isHandRaised}
                  reaction={localSocketId ? reactionsBySocket[localSocketId] : null}
                />
                {remotePeers.map((p) => (
                  <VideoFeed
                    key={p.socketId}
                    stream={p.stream}
                    name={p.name}
                    isVideoOn={p.isVideoOn}
                    isMicOn={p.isMicOn}
                    isHandRaised={raisedHands.some((h) => h.socketId === p.socketId)}
                    reaction={reactionsBySocket[p.socketId]}
                  />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Floating Join Requests Overlay */}
        {joinRequests.length > 0 && currentRoom?.roomId === roomId && (
          <div className="absolute top-20 right-4 sm:top-20 sm:right-6 z-[60] flex flex-col gap-3 w-80 max-w-[calc(100vw-2rem)]">
            <AnimatePresence>
              {joinRequests.map((req) => (
                <motion.div
                  key={req.socketId}
                  initial={{ opacity: 0, y: 20, scale: 0.9 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="glass-panel p-4 rounded-2xl border border-primary/20 shadow-2xl bg-slate-900/90 backdrop-blur-xl"
                >
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-accent flex items-center justify-center font-bold text-white shrink-0 shadow-lg">
                      {req.user?.profileImage ? (
                        <img src={req.user.profileImage} alt="User" className="w-full h-full object-cover rounded-full" />
                      ) : (
                        req.user?.name?.charAt(0) || 'U'
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-white text-sm font-semibold truncate">{req.user?.name || 'Guest'}</h4>
                      <p className="text-secondary text-[10px] truncate mb-2">wants to join this room</p>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => approveJoinRequest(req.roomId, req.userId, req.socketId)}
                          className="flex-1 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-400 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <FiUserCheck /> Approve
                        </button>
                        <button
                          onClick={() => rejectJoinRequest(req.roomId, req.userId, req.socketId, 'Host rejected')}
                          className="flex-1 bg-red-500/20 hover:bg-red-500/30 text-red-400 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
                        >
                          <FiXCircle /> Reject
                        </button>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        )}

        <RoomControls
          onToggleMic={toggleMic}
          onToggleVideo={toggleVideo}
          onToggleScreen={isMeSharing ? stopScreenShare : startScreenShare}
          onToggleWhiteboard={() => setShowWhiteboard(!showWhiteboard)}
          onToggleChat={handleToggleChat}
          onToggleHand={handleToggleHand}
          onSendReaction={handleSendReaction}
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          isScreenSharing={isMeSharing}
          isOtherSharing={isAnySharing && !isMeSharing}
          isWhiteboardOpen={showWhiteboard}
          isChatOpen={showChat}
          isHandRaised={isHandRaised}
          isSpeaking={localSpeaking}
          audioLevel={localAudioLevel}
          unreadCount={showChat ? 0 : unreadChat}
        />
      </motion.div>

      <ParticipantSidebar
        raisedHands={raisedHands}
        isHost={isHost}
        onLowerHand={handleLowerHand}
        mobileOpen={showParticipants}
        onCloseMobile={() => setShowParticipants(false)}
      />
    </div>
  );
};

const RoomDashboard = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const {
    currentRoom,
    joinRoom,
    loading: joining,
    isPendingApproval,
    pendingRoomId,
    cancelJoinRequest,
  } = useRoom();

  const [phase, setPhase] = useState('loading');
  const [mediaPrefs, setMediaPrefs] = useState({ micOn: false, cameraOn: false });

  const attemptJoin = useCallback(
    async (prefs, { isRefresh = false } = {}) => {
      setMediaPrefs(prefs);
      const result = await joinRoom(roomId, {
        navigateToRoom: false,
        micOn: prefs.micOn,
        cameraOn: prefs.cameraOn,
      });
      if (result === 'joined') {
        setPhase('meeting');
        return;
      }
      if (result === 'pending') {
        setPhase('pending');
        return;
      }
      if (!isRefresh) {
        navigate('/join', { replace: true });
      } else {
        setPhase('prejoin');
      }
    },
    [joinRoom, roomId, navigate],
  );

  const bootstrappedRef = useRef(false);

  useEffect(() => {
    if (!roomId || bootstrappedRef.current) return;
    bootstrappedRef.current = true;

    if (isPendingApproval && pendingRoomId === roomId) {
      setPhase('pending');
      return;
    }

    if (currentRoom?.roomId === roomId) {
      const session = readRoomSession(roomId);
      setMediaPrefs({
        micOn: session?.micOn ?? false,
        cameraOn: session?.cameraOn ?? false,
      });
      setPhase('meeting');
      return;
    }

    const session = readRoomSession(roomId);
    if (session) {
      setMediaPrefs({
        micOn: session.micOn ?? false,
        cameraOn: session.cameraOn ?? false,
      });
      setPhase('joining');
      attemptJoin(
        { micOn: session.micOn ?? false, cameraOn: session.cameraOn ?? false },
        { isRefresh: true },
      );
      return;
    }

    setPhase('prejoin');
  }, [roomId, currentRoom?.roomId, attemptJoin, isPendingApproval, pendingRoomId]);

  useEffect(() => {
    if (isPendingApproval && pendingRoomId === roomId) {
      setPhase('pending');
    }
  }, [isPendingApproval, pendingRoomId, roomId]);

  useEffect(() => {
    if (currentRoom?.roomId === roomId && phase !== 'meeting' && !isPendingApproval) {
      setPhase('meeting');
    }
  }, [currentRoom, roomId, phase, isPendingApproval]);

  const handlePreJoin = (prefs) => {
    setPhase('joining');
    attemptJoin(prefs);
  };

  if (phase === 'loading' || phase === 'joining') {
    return (
      <motion.div className="flex h-screen items-center justify-center bg-background">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
          className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full"
        />
      </motion.div>
    );
  }

  if (phase === 'prejoin') {
    return (
      <PreJoinScreen
        roomCode={roomId}
        onJoin={handlePreJoin}
        joining={joining}
      />
    );
  }

  if (phase === 'pending') {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-panel rounded-3xl p-10 max-w-md w-full text-center border border-white/10"
        >
          <div className="w-12 h-12 border-2 border-primary/30 border-t-primary rounded-full animate-spin mx-auto mb-6" />
          <h2 className="text-xl font-bold text-white mb-2">Waiting for host approval</h2>
          <p className="text-secondary text-sm font-light mb-6">
            The host will let you in shortly. Room: {roomId}
          </p>
          <button
            type="button"
            onClick={cancelJoinRequest}
            className="text-xs text-secondary hover:text-white underline"
          >
            Cancel request
          </button>
        </motion.div>
      </div>
    );
  }

  if (phase === 'meeting' && currentRoom?.roomId === roomId) {
    return (
      <RoomMeetingView
        roomId={roomId}
        initialMicOn={mediaPrefs.micOn}
        initialVideoOn={mediaPrefs.cameraOn}
      />
    );
  }

  return (
    <motion.div className="flex h-screen items-center justify-center bg-background">
      <motion.div
        animate={{ rotate: 360 }}
        transition={{ repeat: Infinity, duration: 1, ease: 'linear' }}
        className="w-10 h-10 border-2 border-primary/30 border-t-primary rounded-full"
      />
    </motion.div>
  );
};

export default RoomDashboard;
