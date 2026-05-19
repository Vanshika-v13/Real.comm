import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { FiMaximize, FiMinimize } from 'react-icons/fi';
import { attachMediaStream } from '../utils/mediaPlayback';

const ScreenShareView = ({ stream, presenterName }) => {
  const videoRef = useRef(null);
  const [isFullscreen, setIsFullscreen] = useState(false);

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
  }, [stream]);

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      videoRef.current.parentElement.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="relative w-full h-full rounded-3xl bg-slate-900 border border-white/10 overflow-hidden shadow-2xl group"
    >
      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted={false}
        className="w-full h-full object-contain bg-black"
      />

      {!stream && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="absolute inset-0 flex items-center justify-center bg-slate-950"
        >
          <p className="text-sm text-secondary">Waiting for presentation stream…</p>
        </motion.div>
      )}

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: stream ? 1 : 0 }}
        className="absolute top-6 left-6 flex items-center gap-3 px-4 py-2 rounded-2xl bg-black/40 backdrop-blur-md border border-white/10 opacity-0 group-hover:opacity-100 transition-opacity"
      >
        <motion.div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white text-xs font-bold">
          {presenterName?.charAt(0)}
        </motion.div>
        <div>
          <p className="text-[10px] text-secondary uppercase tracking-widest leading-none mb-1">Presenting</p>
          <p className="text-sm font-semibold text-white leading-none">{presenterName}</p>
        </div>
      </motion.div>

      <motion.div className="absolute bottom-6 right-6 flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={toggleFullscreen}
          className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:bg-white/10 transition-all"
        >
          {isFullscreen ? <FiMinimize /> : <FiMaximize />}
        </button>
      </motion.div>

      <motion.div
        animate={{ opacity: stream ? 1 : 0.3 }}
        className="absolute inset-0 border-2 border-primary/30 rounded-3xl pointer-events-none shadow-[inset_0_0_40px_rgba(99,102,241,0.1)]"
      />
    </motion.div>
  );
};

export default ScreenShareView;
