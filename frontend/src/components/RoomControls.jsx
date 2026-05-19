import React from 'react';
import { motion } from 'framer-motion';
import {
  FiMic, FiMicOff,
  FiVideo, FiVideoOff,
  FiMonitor, FiLogOut,
  FiMessageSquare,
  FiEdit3,
} from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';

const RoomControls = ({
  onToggleMic,
  onToggleVideo,
  onToggleScreen,
  onToggleWhiteboard,
  onToggleChat,
  isMicOn,
  isVideoOn,
  isScreenSharing,
  isOtherSharing,
  isWhiteboardOpen,
  isChatOpen,
  isSpeaking = false,
  audioLevel = 0,
}) => {
  const { leaveRoom } = useRoom();
  const showVoiceGlow = isMicOn && (isSpeaking || audioLevel > 0.015);

  return (
    <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50">
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="glass-panel px-6 py-4 rounded-3xl flex items-center gap-4 shadow-2xl shadow-black/50 border-white/10"
      >
        <MicControlButton
          active={isMicOn}
          onClick={onToggleMic}
          icon={isMicOn ? <FiMic /> : <FiMicOff />}
          label={isMicOn ? 'Mute' : 'Unmute'}
          showVoiceGlow={showVoiceGlow}
          audioLevel={audioLevel}
        />
        <ControlButton
          active={isVideoOn}
          onClick={onToggleVideo}
          icon={isVideoOn ? <FiVideo /> : <FiVideoOff />}
          label={isVideoOn ? 'Stop Video' : 'Start Video'}
        />

        <motion.div className="w-px h-8 bg-white/10 mx-2" />

        <ControlButton
          active={!isScreenSharing}
          disabled={isOtherSharing}
          onClick={onToggleScreen}
          icon={<FiMonitor />}
          label={isScreenSharing ? 'Stop Sharing' : (isOtherSharing ? 'Someone else is presenting' : 'Share Screen')}
          isAccent={isScreenSharing}
        />

        <ControlButton
          active={!isWhiteboardOpen}
          onClick={onToggleWhiteboard}
          icon={<FiEdit3 />}
          label={isWhiteboardOpen ? 'Close Board' : 'Whiteboard'}
          isAccent={isWhiteboardOpen}
        />

        <ControlButton
          active={!isChatOpen}
          onClick={onToggleChat}
          icon={<FiMessageSquare />}
          label={isChatOpen ? 'Close Chat' : 'Chat'}
          isAccent={isChatOpen}
        />

        <motion.div className="w-px h-8 bg-white/10 mx-2" />

        <button
          type="button"
          onClick={leaveRoom}
          className="w-12 h-12 rounded-2xl bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all flex items-center justify-center group relative"
        >
          <FiLogOut className="w-5 h-5" />
          <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
            Leave Room
          </span>
        </button>
      </motion.div>
    </div>
  );
};

const MicControlButton = ({ icon, active = true, onClick, label, showVoiceGlow, audioLevel }) => (
  <motion.button
    type="button"
    onClick={onClick}
    animate={{
      scale: showVoiceGlow ? 1.08 : 1,
      boxShadow: showVoiceGlow
        ? '0 0 20px rgba(99, 102, 241, 0.45)'
        : '0 0 0px transparent',
    }}
    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
    className={`
      w-12 h-12 rounded-2xl flex items-center justify-center transition-all group relative
      ${active
        ? 'bg-white/5 text-white hover:bg-white/10'
        : 'bg-accent/20 text-accent hover:bg-accent/30'}
    `}
  >
    <span className="w-5 h-5">{icon}</span>
    {showVoiceGlow && (
      <motion.span
        className="absolute -top-1 -right-1 flex items-end gap-px h-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
      >
        {[0.4, 0.7, 0.5].map((h, i) => (
          <motion.span
            key={i}
            className="w-0.5 bg-emerald-400 rounded-full"
            animate={{ height: `${(h + audioLevel * 0.5) * 8}px` }}
            transition={{ type: 'spring', stiffness: 300, damping: 18 }}
          />
        ))}
      </motion.span>
    )}
    {label && (
      <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
        {label}
      </span>
    )}
  </motion.button>
);

const ControlButton = ({ icon, active = true, onClick, label, disabled, isAccent }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      w-12 h-12 rounded-2xl flex items-center justify-center transition-all group relative
      ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      ${isAccent
        ? 'bg-primary text-white shadow-lg shadow-primary/20'
        : (active
          ? 'bg-white/5 text-white hover:bg-white/10'
          : 'bg-accent/20 text-accent hover:bg-accent/30')}
    `}
  >
    <span className="w-5 h-5">{icon}</span>
    {label && (
      <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
        {label}
      </span>
    )}
  </button>
);

export default RoomControls;
