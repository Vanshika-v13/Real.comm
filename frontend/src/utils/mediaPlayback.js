import { mediaLog } from './mediaLogger';

/**
 * Attach a MediaStream to a media element and attempt playback (handles autoplay policy).
 *
 * Key fixes for remote video black screen:
 * 1. Always reassign srcObject when the new stream has a video track the element doesn't.
 * 2. When a video track is muted (no frames yet), listen for `unmute` to replay.
 * 3. On loadedmetadata, force play so the first frame is rendered.
 */
export const attachMediaStream = async (element, stream) => {
  if (!element) return;

  if (!stream) {
    element.srcObject = null;
    return;
  }

  // Determine if the existing srcObject already has this stream's video track.
  // If not (e.g. renegotiation added a new video track), force reassignment.
  const incomingVideo =
    stream.getVideoTracks().find((t) => t.readyState === 'live') ?? stream.getVideoTracks()[0];
  const existingVideo =
    element.srcObject?.getVideoTracks().find((t) => t.readyState === 'live')
    ?? element.srcObject?.getVideoTracks()[0];
  const needsReassign =
    element.srcObject !== stream ||
    (incomingVideo && incomingVideo !== existingVideo);

  if (needsReassign) {
    element.srcObject = stream;
    if (import.meta.env.DEV) {
      mediaLog.info('playback', '[REMOTE-VIDEO] srcObject updated', {
        hasVideo: !!incomingVideo,
        videoReadyState: incomingVideo?.readyState,
        videoMuted: incomingVideo?.muted,
        videoEnabled: incomingVideo?.enabled,
      });
    }
  }

  // Ensure remote audio can play (local preview sets muted via React props).
  if (!element.muted) {
    element.volume = 1;
  }

  const playStream = async () => {
    if (element.srcObject !== stream) return;
    try {
      await element.play();
      if (import.meta.env.DEV) {
        mediaLog.info('playback', '[REMOTE-VIDEO] playback started');
      }
    } catch (err) {
      mediaLog.warn('playback', 'Autoplay blocked; retry on user gesture', err?.message);
      const retry = () => {
        element.play().catch(() => {});
        document.removeEventListener('click', retry);
        document.removeEventListener('keydown', retry);
      };
      document.addEventListener('click', retry, { once: true });
      document.addEventListener('keydown', retry, { once: true });
    }
  };

  await playStream();

  const cleanups = [];

  // When loadedmetadata fires, first frame is available — force play.
  const onLoadedMetadata = () => {
    if (element.srcObject === stream) {
      playStream();
    }
  };
  element.addEventListener('loadedmetadata', onLoadedMetadata);
  cleanups.push(() => element.removeEventListener('loadedmetadata', onLoadedMetadata));

  const onTrackEvent = () => {
    if (element.srcObject === stream) {
      playStream();
    }
  };

  const bindTrack = (track) => {
    // When a remote video track fires `unmute`, the browser has received the first frame.
    // This is the correct moment to ensure playback is running.
    track.addEventListener('mute', onTrackEvent);
    track.addEventListener('unmute', onTrackEvent);
    track.addEventListener('ended', onTrackEvent);
    cleanups.push(() => {
      track.removeEventListener('mute', onTrackEvent);
      track.removeEventListener('unmute', onTrackEvent);
      track.removeEventListener('ended', onTrackEvent);
    });
    if (import.meta.env.DEV) {
      mediaLog.debug('playback', `Bound stream track ${track.kind}`, {
        enabled: track.enabled,
        muted: track.muted,
        readyState: track.readyState,
      });
    }
  };

  stream.getTracks().forEach(bindTrack);

  const onAddTrack = (event) => {
    onTrackEvent();
    if (event.track) bindTrack(event.track);
  };

  stream.addEventListener('addtrack', onAddTrack);
  stream.addEventListener('removetrack', onTrackEvent);
  cleanups.push(() => {
    stream.removeEventListener('addtrack', onAddTrack);
    stream.removeEventListener('removetrack', onTrackEvent);
  });

  return () => {
    cleanups.forEach((fn) => fn());
  };
};
