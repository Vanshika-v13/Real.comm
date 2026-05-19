import React, { useEffect, useState, useMemo, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '../context/RoomContext';
import { useAuth } from '../context/AuthContext';
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
import { FiCopy, FiLayout, FiFolder } from 'react-icons/fi';
import socketService from '../services/socketService';
import { dedupeParticipants } from '../utils/participants';


const RoomDashboard = () => {
  const { roomId } = useParams();
  const navigate = useNavigate();
  const { currentRoom, participants, joinRoom, loading: joining } = useRoom();
  const { user } = useAuth();
  const { toast } = useToast();
  const [showWhiteboard, setShowWhiteboard] = useState(false);
  const [showFilePanel, setShowFilePanel] = useState(false);
  const [showChat, setShowChat] = useState(false);
  const [gridCols, setGridCols] = useState(2);
  const [joinAttempted, setJoinAttempted] = useState(false);

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
  } = useWebRTC(roomId);

  const startConferencingRef = useRef(startConferencing);
  useEffect(() => {
    startConferencingRef.current = startConferencing;
  }, [startConferencing]);

  const { level: localAudioLevel, isSpeaking: localSpeaking } = useVoiceActivity(localStream, isMicOn);

  const { files, isUploading, uploadProgress, uploadFile, downloadFile } = useFiles(roomId);

  useEffect(() => {
    if (!roomId || joinAttempted) return;
    if (currentRoom?.roomId === roomId) {
      setJoinAttempted(true);
      return;
    }
    setJoinAttempted(true);
    joinRoom(roomId, { navigateToRoom: false }).then((ok) => {
      if (!ok) navigate('/join', { replace: true });
    });
  }, [roomId, currentRoom, joinRoom, joinAttempted, navigate]);

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

  if ((joining && !currentRoom) || !currentRoom || currentRoom.roomId !== roomId) {
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

  const isAnySharing = !!presenter;
  const isMeSharing = presenter?.socketId === socketService.getSocket()?.id;
  const activeScreenStream = isMeSharing
    ? screenStream
    : presenter
      ? remoteScreenStreams[presenter.socketId]
      : null;

  const totalVideos = 1 + remotePeers.length;
  const gridClass =
    gridCols === 1 ? 'grid-cols-1' : gridCols === 3 ? 'grid-cols-3' : 'grid-cols-2';

  return (
    <div className="flex h-screen bg-background text-foreground overflow-hidden">
      <motion.div className="flex-1 flex flex-col relative min-w-0">
        <AnimatePresence>
          {showWhiteboard && <Whiteboard roomId={roomId} onClose={() => setShowWhiteboard(false)} />}
          {showFilePanel && (
            <FilePanel
              files={files}
              isUploading={isUploading}
              uploadProgress={uploadProgress}
              onUpload={uploadFile}
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
          {showChat && <ChatPanel onClose={() => setShowChat(false)} />}
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
              onClick={() => setGridCols((c) => (c >= 3 ? 1 : c + 1))}
              className="p-2.5 text-secondary hover:text-white hover:bg-white/5 rounded-xl transition-all"
              title="Toggle layout"
            >
              <FiLayout size={18} />
            </button>
          </div>
        </header>

        <div className="flex-1 p-4 sm:p-6 relative overflow-hidden flex flex-col gap-4 sm:gap-6 min-h-0">
          <AnimatePresence mode="wait">
            {isAnySharing ? (
              <motion.div
                key="presentation"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="flex-1 flex flex-col gap-4 min-h-0"
              >
                <div className="flex-1 min-h-0">
                  <ScreenShareView
                    stream={activeScreenStream}
                    presenterName={isMeSharing ? 'You' : presenter.userName}
                  />
                </div>
                <div className="h-32 sm:h-40 flex gap-3 overflow-x-auto pb-2 custom-scrollbar shrink-0">
                  <div className="min-w-[180px] sm:min-w-[240px]">
                    <VideoFeed
                      stream={localStream}
                      name={user?.name}
                      isMe
                      isVideoOn={isVideoOn}
                      isMicOn={isMicOn}
                      mediaRevision={localMediaRevision}
                    />
                  </div>
                  {remotePeers.map((p) => (
                    <div key={p.socketId} className="min-w-[180px] sm:min-w-[240px]">
                      <VideoFeed stream={p.stream} name={p.name} isVideoOn={p.isVideoOn} isMicOn={p.isMicOn} />
                    </div>
                  ))}
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className={`grid gap-3 sm:gap-4 h-full min-h-0 ${totalVideos <= 1 ? 'grid-cols-1' : gridClass}`}
              >
                <VideoFeed
                  stream={localStream}
                  name={user?.name}
                  isMe
                  isVideoOn={isVideoOn}
                  isMicOn={isMicOn}
                  mediaRevision={localMediaRevision}
                />
                {remotePeers.map((p) => (
                  <VideoFeed key={p.socketId} stream={p.stream} name={p.name} isVideoOn={p.isVideoOn} isMicOn={p.isMicOn} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <RoomControls
          onToggleMic={toggleMic}
          onToggleVideo={toggleVideo}
          onToggleScreen={isMeSharing ? stopScreenShare : startScreenShare}
          onToggleWhiteboard={() => setShowWhiteboard(!showWhiteboard)}
          onToggleChat={() => setShowChat(!showChat)}
          isMicOn={isMicOn}
          isVideoOn={isVideoOn}
          isScreenSharing={isMeSharing}
          isOtherSharing={isAnySharing && !isMeSharing}
          isWhiteboardOpen={showWhiteboard}
          isChatOpen={showChat}
          isSpeaking={localSpeaking}
          audioLevel={localAudioLevel}
        />
      </motion.div>

      <ParticipantSidebar />
    </div>
  );
};

export default RoomDashboard;
