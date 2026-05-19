import { useState, useEffect, useRef } from 'react';

const SPEAK_THRESHOLD = 0.045;
const IDLE_THRESHOLD = 0.025;

/**
 * Lightweight voice activity detection via Web Audio AnalyserNode.
 */
export const useVoiceActivity = (stream, enabled = true) => {
  const [level, setLevel] = useState(0);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const speakingRef = useRef(false);

  useEffect(() => {
    if (!enabled || !stream) {
      setLevel(0);
      setIsSpeaking(false);
      speakingRef.current = false;
      return undefined;
    }

    const audioTrack = stream.getAudioTracks()[0];
    if (!audioTrack || !audioTrack.enabled) {
      setLevel(0);
      setIsSpeaking(false);
      speakingRef.current = false;
      return undefined;
    }

    let rafId;
    let audioContext;
    let cancelled = false;

    const start = async () => {
      try {
        audioContext = new AudioContext();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const analyser = audioContext.createAnalyser();
        analyser.fftSize = 512;
        analyser.smoothingTimeConstant = 0.75;
        source.connect(analyser);

        const freqData = new Uint8Array(analyser.frequencyBinCount);
        const timeData = new Uint8Array(analyser.fftSize);

        const tick = () => {
          if (cancelled) return;

          analyser.getByteFrequencyData(freqData);
          analyser.getByteTimeDomainData(timeData);

          let freqSum = 0;
          for (let i = 0; i < freqData.length; i += 1) {
            freqSum += freqData[i];
          }
          const freqLevel = freqSum / (freqData.length * 255);

          let timeSum = 0;
          for (let i = 0; i < timeData.length; i += 1) {
            const v = (timeData[i] - 128) / 128;
            timeSum += v * v;
          }
          const rms = Math.sqrt(timeSum / timeData.length);

          const normalized = Math.min(1, freqLevel * 0.55 + rms * 1.8);
          setLevel(normalized);

          const threshold = speakingRef.current ? IDLE_THRESHOLD : SPEAK_THRESHOLD;
          const speaking = normalized > threshold;
          speakingRef.current = speaking;
          setIsSpeaking(speaking);

          rafId = requestAnimationFrame(tick);
        };

        tick();
      } catch {
        if (!cancelled) {
          setLevel(0);
          setIsSpeaking(false);
        }
      }
    };

    start();

    const resumeOnGesture = () => {
      if (audioContext?.state === 'suspended') {
        audioContext.resume().catch(() => {});
      }
    };
    document.addEventListener('click', resumeOnGesture);
    document.addEventListener('keydown', resumeOnGesture);

    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      document.removeEventListener('click', resumeOnGesture);
      document.removeEventListener('keydown', resumeOnGesture);
      if (audioContext) {
        audioContext.close().catch(() => {});
      }
    };
  }, [stream, enabled]);

  return { level, isSpeaking };
};
