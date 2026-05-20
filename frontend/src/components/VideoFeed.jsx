import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiMicOff, FiVideoOff } from 'react-icons/fi';
import { attachMediaStream } from '../utils/mediaPlayback';
import { useVoiceActivity } from '../hooks/useVoiceActivity';
import { getAvatarUrl } from '../utils/avatar';

const AudioBars = ({ level, active }) => {
  const heights = [0.35, 0.55, 0.75, 0.55, 0.35].map((h) => h + level * 0.65);

  return (
    <motion.div
      className="flex items-end gap-0.5 h-3"
      animate={{ opacity: active ? 1 : 0.35 }}
    >
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-emerald-400"
          animate={{ height: `${Math.max(3, h * 12)}px` }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        />
      ))}
    </motion.div>
  );
};

const VideoFeed = ({
  stream,
  name,
  isMe,
  isVideoOn,
  isMicOn,
  mediaRevision = 0,
  profileImage,
  isHandRaised,
  reaction,
}) => {
  const videoRef = useRef(null);
  const [trackTick, setTrackTick] = useState(0);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const audioTrack = stream?.getAudioTracks()[0];
  const videoTrack =
    stream?.getVideoTracks().find((t) => t.readyState === 'live') ?? stream?.getVideoTracks()[0];

  useEffect(() => {
    if (reaction && reaction.emoji) {
      setFloatingReactions((prev) => [...prev, reaction]);
      const timer = setTimeout(() => {
        setFloatingReactions((prev) => prev.filter((r) => r.id !== reaction.id));
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [reaction]);

  const micActive = isMicOn !== false && (!audioTrack || audioTrack.enabled);
  // videoActive requires an ACTUAL live+enabled video track.
  // Previously: (!videoTrack || videoTrack.enabled) was true when videoTrack=null,
  // showing a black video element instead of the avatar placeholder.
  const hasLiveVideo = Boolean(videoTrack && videoTrack.readyState !== 'ended' && videoTrack.enabled);
  const videoActive = isVideoOn !== false && hasLiveVideo;

  const vadEnabled = Boolean(stream && micActive);
  const { level: audioLevel, isSpeaking } = useVoiceActivity(stream, vadEnabled);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return undefined;

    let detachListeners;
    attachMediaStream(el, stream).then((cleanup) => {
      detachListeners = cleanup;
    });

    return () => {
      detachListeners?.();
      if (el.srcObject === stream) {
        el.srcObject = null;
      }
    };
  }, [stream, videoActive, trackTick, mediaRevision, isMicOn, isVideoOn]);

  useEffect(() => {
    if (!stream) return undefined;

    const bump = () => setTrackTick((n) => n + 1);

    // Listen on current tracks.
    const tracks = stream.getTracks();
    tracks.forEach((track) => {
      track.addEventListener('mute', bump);
      track.addEventListener('unmute', bump);
      track.addEventListener('ended', bump);
    });

    // Also listen for new tracks being added to the stream (e.g. video renegotiation).
    const onAddTrack = (evt) => {
      bump();
      if (evt.track) {
        evt.track.addEventListener('mute', bump);
        evt.track.addEventListener('unmute', bump);
        evt.track.addEventListener('ended', bump);
      }
    };
    stream.addEventListener('addtrack', onAddTrack);
    stream.addEventListener('removetrack', bump);

    return () => {
      tracks.forEach((track) => {
        track.removeEventListener('mute', bump);
        track.removeEventListener('unmute', bump);
        track.removeEventListener('ended', bump);
      });
      stream.removeEventListener('addtrack', onAddTrack);
      stream.removeEventListener('removetrack', bump);
    };
  }, [stream]);

  const showVoiceIndicator = micActive && (isSpeaking || audioLevel > 0.015);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{
        opacity: 1,
        scale: 1,
        boxShadow: showVoiceIndicator
          ? '0 0 0 2px rgba(99, 102, 241, 0.45), 0 0 24px rgba(99, 102, 241, 0.15)'
          : '0 0 0 0px transparent',
      }}
      exit={{ opacity: 0, scale: 0.9 }}
      className="relative rounded-3xl bg-slate-900/50 border border-white/5 overflow-hidden group aspect-video flex items-center justify-center shadow-lg"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={isMe}
        className={`w-full h-full object-cover transition-opacity duration-500 ${videoActive ? 'opacity-100' : 'opacity-0'}`}
      />

      {!videoActive && (
        <motion.div
          animate={{ scale: showVoiceIndicator ? 1.03 : 1 }}
          className="absolute inset-0 flex items-center justify-center bg-slate-900"
        >
          <motion.div
            animate={{
              boxShadow: showVoiceIndicator
                ? '0 0 30px rgba(99, 102, 241, 0.35)'
                : '0 0 0px transparent',
            }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-white text-3xl font-bold shadow-2xl overflow-hidden"
          >
            {profileImage ? (
              <img src={getAvatarUrl(profileImage)} alt={name} className="w-full h-full object-cover" />
            ) : (
              name?.charAt(0)
            )}
          </motion.div>
          <motion.div
            animate={{ opacity: showVoiceIndicator ? 0.4 : 1 }}
            className="absolute bottom-1/4"
          >
            <FiVideoOff className="text-secondary w-6 h-6 animate-pulse" />
          </motion.div>
        </motion.div>
      )}

      <motion.div
        animate={{
          borderColor: showVoiceIndicator ? 'rgba(99, 102, 241, 0.35)' : 'rgba(255,255,255,0)',
        }}
        className="absolute inset-0 border-2 rounded-3xl pointer-events-none transition-colors"
      />

      <motion.div
        animate={{ scale: showVoiceIndicator ? 1.02 : 1 }}
        className="absolute bottom-2 left-2 sm:bottom-4 sm:left-4 flex items-center gap-1.5 sm:gap-2 px-2 sm:px-3 py-1 sm:py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 z-10 max-w-[calc(100%-1rem)]"
      >
        {!micActive && <FiMicOff className="text-accent w-3 h-3" />}
        {micActive && <AudioBars level={audioLevel} active={showVoiceIndicator} />}
        <motion.div
          animate={{
            backgroundColor: showVoiceIndicator ? '#10b981' : videoActive ? '#10b981' : '#64748b',
            scale: showVoiceIndicator ? 1.25 : 1,
          }}
          className="w-1.5 h-1.5 rounded-full"
        />
        <span className="text-[10px] sm:text-xs font-medium text-white truncate">
          {name} {isMe ? '(You)' : ''}
        </span>
      </motion.div>

      <motion.div
        animate={{ borderColor: showVoiceIndicator ? 'rgba(99,102,241,0.2)' : 'rgba(99,102,241,0)' }}
        className="absolute inset-0 border-2 rounded-3xl pointer-events-none transition-all"
      />

      {/* Hand Raised Pulse Overlay */}
      <AnimatePresence>
        {isHandRaised && (
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: -10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.6, opacity: 0, y: -10 }}
            className="absolute top-4 right-4 z-20 flex items-center justify-center p-2.5 rounded-2xl bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/25 border border-amber-400/20"
          >
            <svg stroke="currentColor" fill="currentColor" strokeWidth="0" viewBox="0 0 512 512" height="18" width="18" xmlns="http://www.w3.org/2000/svg">
              <path d="M424 224a32.06 32.06 0 0 0-32 32v120c0 4.4-3.6 8-8 8s-8-3.6-8-8V80a32.06 32.06 0 0 0-32-32 32.06 32.06 0 0 0-32 32v176c0 4.4-3.6 8-8 8s-8-3.6-8-8V48a32.06 32.06 0 0 0-32-32 32.06 32.06 0 0 0-32 32v208c0 4.4-3.6 8-8 8s-8-3.6-8-8V80a32.06 32.06 0 0 0-32-32 32.06 32.06 0 0 0-32 32v176c0 4.4-3.6 8-8 8s-8-3.6-8-8V176a32.06 32.06 0 0 0-32-32 32.06 32.06 0 0 0-32 32v188.15c0 82.26 66.89 149.85 149.12 151.83A160.07 160.07 0 0 0 424 356V256a32.06 32.06 0 0 0-32-32z" />
            </svg>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating Reactions Overlay */}
      <div className="absolute inset-0 pointer-events-none z-20 overflow-hidden">
        <AnimatePresence>
          {floatingReactions.map((r) => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 80, scale: 0.5, x: 0 }}
              animate={{
                opacity: [0, 1, 1, 0],
                y: -120,
                scale: [0.5, 1.3, 1.3, 0.8],
                x: [0, (Math.random() - 0.5) * 80, (Math.random() - 0.5) * 80]
              }}
              exit={{ opacity: 0 }}
              transition={{ duration: 2, ease: 'easeOut' }}
              className="absolute bottom-12 left-1/2 -translate-x-1/2 text-4xl sm:text-5xl filter drop-shadow-lg"
            >
              {r.emoji}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </motion.div>
  );
};

export default VideoFeed;
