import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FiMic, FiMicOff,
  FiVideo, FiVideoOff,
  FiMonitor, FiLogOut,
  FiMessageSquare,
  FiEdit3,
  FiSmile,
} from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';

const HandIcon = () => (
  <svg stroke="currentColor" fill="none" strokeWidth="2.2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round" height="1.15em" width="1.15em" xmlns="http://www.w3.org/2000/svg">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v5" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v6" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v7.5" />
    <path d="M6 13V9h-.5a1.5 1.5 0 0 0 0 3" />
    <path d="M18 10a2 2 0 0 1 2 2v5a7 7 0 0 1-7 7h-2.14a4 4 0 0 1-3.64-2.34L6 17.5" />
  </svg>
);

const RoomControls = ({
  onToggleMic,
  onToggleVideo,
  onToggleScreen,
  onToggleWhiteboard,
  onToggleChat,
  onToggleHand,
  onSendReaction,
  isMicOn,
  isVideoOn,
  isScreenSharing,
  isOtherSharing,
  isWhiteboardOpen,
  isChatOpen,
  isHandRaised,
  isSpeaking = false,
  audioLevel = 0,
  unreadCount = 0,
}) => {
  const { leaveRoom } = useRoom();
  const showVoiceGlow = isMicOn && (isSpeaking || audioLevel > 0.015);
  
  const [showReactions, setShowReactions] = useState(false);
  const reactionPanelRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (reactionPanelRef.current && !reactionPanelRef.current.contains(event.target)) {
        setShowReactions(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] sm:bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-[min(100vw-1rem,100%)] px-2 sm:px-0 sm:max-w-max flex justify-center pointer-events-none">
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="glass-panel pointer-events-auto px-2 py-2 sm:px-6 sm:py-4 rounded-[1.25rem] sm:rounded-3xl flex flex-wrap items-center justify-center gap-1.5 sm:gap-4 shadow-2xl shadow-black/50 border-white/10 max-w-full"
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

        <motion.div className="w-px h-8 bg-white/10 mx-1 sm:mx-2 hidden sm:block" />

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
          badgeCount={unreadCount}
        />

        <ControlButton
          active={!isHandRaised}
          onClick={onToggleHand}
          icon={<HandIcon />}
          label={isHandRaised ? 'Lower Hand' : 'Raise Hand'}
          isAccent={isHandRaised}
        />

        <div className="relative">
          <ControlButton
            active={!showReactions}
            onClick={() => setShowReactions((prev) => !prev)}
            icon={<FiSmile />}
            label="Reactions"
            isAccent={showReactions}
          />
          <AnimatePresence>
            {showReactions && (
              <motion.div
                ref={reactionPanelRef}
                initial={{ opacity: 0, y: 10, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10, scale: 0.95 }}
                className="absolute bottom-16 left-1/2 -translate-x-1/2 p-2 rounded-2xl bg-slate-950/90 backdrop-blur-xl border border-white/10 flex gap-2 shadow-2xl z-50 whitespace-nowrap"
              >
                {['👍', '❤️', '😂', '😮', '👏'].map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => {
                      onSendReaction(emoji);
                      setShowReactions(false);
                    }}
                    className="w-10 h-10 rounded-xl hover:bg-white/10 text-2xl flex items-center justify-center transition-all hover:scale-125"
                  >
                    {emoji}
                  </button>
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <motion.div className="w-px h-8 bg-white/10 mx-1 sm:mx-2 hidden sm:block" />

        <button
          type="button"
          onClick={leaveRoom}
          className="w-14 h-14 sm:w-16 sm:h-16 rounded-2xl sm:rounded-[1.5rem] bg-accent/20 text-accent hover:bg-accent hover:text-white transition-all flex items-center justify-center group relative"
        >
          <FiLogOut className="w-6 h-6 sm:w-7 sm:h-7" />
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
      w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all group relative
      ${active
        ? 'bg-white/5 text-white hover:bg-white/10'
        : 'bg-accent/20 text-accent hover:bg-accent/30'}
    `}
  >
    <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center relative">{icon}</span>
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

const ControlButton = ({ icon, active = true, onClick, label, disabled, isAccent, badgeCount }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={disabled}
    className={`
      w-12 h-12 sm:w-14 sm:h-14 rounded-2xl flex items-center justify-center transition-all group relative
      ${disabled ? 'opacity-30 cursor-not-allowed' : ''}
      ${isAccent
        ? 'bg-primary text-white shadow-lg shadow-primary/20'
        : (active
          ? 'bg-white/5 text-white hover:bg-white/10'
          : 'bg-accent/20 text-accent hover:bg-accent/30')}
    `}
  >
    <span className="w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center relative">{icon}</span>
    {badgeCount > 0 && (
      <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-accent text-[9px] font-bold rounded-full flex items-center justify-center text-white border-2 border-slate-950 px-1">
        {badgeCount}
      </span>
    )}
    {label && (
      <span className="absolute -top-10 scale-0 group-hover:scale-100 transition-all bg-slate-900 text-white text-xs px-2 py-1 rounded whitespace-nowrap">
        {label}
      </span>
    )}
  </button>
);

export default RoomControls;
