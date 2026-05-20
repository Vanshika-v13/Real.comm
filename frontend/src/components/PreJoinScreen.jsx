import React, { useState, useEffect, useRef, useCallback } from 'react';
import { FiMic, FiMicOff, FiVideo, FiVideoOff } from 'react-icons/fi';
import Button from './Button';
import { useAuth } from '../context/AuthContext';

const PreJoinScreen = ({ roomCode, onJoin, joining = false }) => {
  const { user } = useAuth();

  const [micOn, setMicOn] = useState(false);
  const [cameraOn, setCameraOn] = useState(false);
  const [previewStream, setPreviewStream] = useState(null);
  const previewStreamRef = useRef(null);
  const videoRef = useRef(null);

  const cleanupPreviewStream = useCallback(() => {
    if (previewStreamRef.current) {
      previewStreamRef.current.getTracks().forEach((track) => track.stop());
      previewStreamRef.current = null;
    }
    setPreviewStream(null);
  }, []);

  useEffect(() => {
    return () => cleanupPreviewStream();
  }, [cleanupPreviewStream]);

  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.srcObject = previewStream || null;
    }
  }, [previewStream]);

  const updateCameraPreview = useCallback(
    async (shouldBeOn) => {
      if (!shouldBeOn) {
        cleanupPreviewStream();
        return;
      }

      try {
        cleanupPreviewStream();
        const raw = await navigator.mediaDevices.getUserMedia({
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
            facingMode: 'user',
          },
          audio: false,
        });
        const videoTrack = raw.getVideoTracks()[0];
        if (!videoTrack) {
          raw.getTracks().forEach((t) => t.stop());
          throw new Error('No video track');
        }
        previewStreamRef.current = new MediaStream([videoTrack]);
        setPreviewStream(previewStreamRef.current);
      } catch (err) {
        console.error('[PreJoin] Camera preview failed:', err);
        setCameraOn(false);
        cleanupPreviewStream();
      }
    },
    [cleanupPreviewStream],
  );

  const handleToggleCamera = useCallback(() => {
    const next = !cameraOn;
    setCameraOn(next);
    updateCameraPreview(next);
  }, [cameraOn, updateCameraPreview]);

  const handleToggleMic = useCallback(() => {
    setMicOn((prev) => !prev);
  }, []);

  const handleJoinClick = useCallback(() => {
    cleanupPreviewStream();
    onJoin({ micOn, cameraOn });
  }, [micOn, cameraOn, onJoin, cleanupPreviewStream]);

  const initials = (() => {
    const name = user?.fullName || user?.name || 'User';
    return name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  })();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background text-foreground p-6">
      <div className="w-full max-w-xl flex flex-col items-center space-y-8">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-bold text-white tracking-tight">Ready to join?</h1>
          <p className="text-secondary text-sm font-light">
            Meeting code:{' '}
            <span className="text-primary font-medium select-all">{roomCode}</span>
          </p>
        </div>

        <div className="relative w-full aspect-video rounded-3xl bg-slate-900/60 border border-white/5 flex flex-col items-center justify-center overflow-hidden shadow-2xl backdrop-blur-md">
          {cameraOn && previewStream ? (
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className="w-full h-full object-cover scale-x-[-1]"
            />
          ) : (
            <div className="flex flex-col items-center justify-center gap-4">
              <div className="w-24 h-24 rounded-full bg-primary/10 border border-primary/20 text-primary flex items-center justify-center text-3xl font-semibold select-none shadow-lg">
                {initials}
              </div>
              <p className="text-secondary text-xs font-light tracking-widest uppercase">
                Camera is off
              </p>
            </div>
          )}

          <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-xl bg-black/60 border border-white/5 backdrop-blur-md flex items-center gap-2 text-xs font-medium text-white shadow-md">
            {micOn ? (
              <>
                <FiMic className="text-emerald-400 w-3.5 h-3.5" />
                <span>Microphone On</span>
              </>
            ) : (
              <>
                <FiMicOff className="text-accent w-3.5 h-3.5" />
                <span className="text-secondary">Muted</span>
              </>
            )}
          </div>

          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-4">
            <button
              type="button"
              onClick={handleToggleMic}
              title={micOn ? 'Mute microphone' : 'Unmute microphone'}
              className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ${
                micOn
                  ? 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                  : 'bg-accent/20 hover:bg-accent/35 text-accent border-accent/30'
              }`}
            >
              {micOn ? <FiMic className="w-5 h-5" /> : <FiMicOff className="w-5 h-5" />}
            </button>

            <button
              type="button"
              onClick={handleToggleCamera}
              title={cameraOn ? 'Turn camera off' : 'Turn camera on'}
              className={`w-12 h-12 rounded-full border flex items-center justify-center shadow-lg transition-all duration-200 active:scale-95 ${
                cameraOn
                  ? 'bg-white/10 hover:bg-white/20 text-white border-white/15'
                  : 'bg-accent/20 hover:bg-accent/35 text-accent border-accent/30'
              }`}
            >
              {cameraOn ? <FiVideo className="w-5 h-5" /> : <FiVideoOff className="w-5 h-5" />}
            </button>
          </div>
        </div>

        <div className="w-full flex justify-center pt-4">
          <Button
            onClick={handleJoinClick}
            isLoading={joining}
            className="w-full sm:w-auto px-12 h-14 rounded-2xl text-base font-semibold shadow-xl shadow-primary/20"
          >
            Join Meeting
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PreJoinScreen;
