import { useState, useEffect, useRef, useCallback } from 'react';
import socketService from '../services/socketService';
import { mediaLog } from '../utils/mediaLogger';
import { useToast } from '../context/ToastContext';

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

/**
 * Module-level media session — survives React Strict Mode remount so we never
 * call getUserMedia twice while the first device handle is still active.
 */
const localMediaSingleton = {
  stream: null,
  initPromise: null,
  roomId: null,
  failed: false,
};

let useWebRTCMediaRetainCount = 0;
let pendingMediaReleaseTimer = null;

/** Module-level joiner camera acquire — survives Strict Mode remounts.
 *  Coalesces concurrent calls; cleared only in acquire finally (never on hook unmount).
 */
let videoAcquirePromise = null;
/** Set when last camera acquire failed; cleared only after a live track is confirmed on the local stream. */
let videoRetryFailed = false;
/** Timestamp of last failed acquire — enforces minimum cooldown before another attempt. */
let videoRetryLastFailedAt = 0;
/** Prevents overlapping answerer outbound sync / renegotiation while a toggle is in flight. */
let answererOutboundSyncInProgress = false;
/** Camera hardware locked by another app/browser — poll until available or room exit. */
let videoCameraInUse = false;
let videoCameraInUseTimer = null;
let videoCameraInUsePollAttempt = null;

const clearVideoCameraInUsePoll = () => {
  if (videoCameraInUseTimer) {
    clearTimeout(videoCameraInUseTimer);
    videoCameraInUseTimer = null;
  }
};

const scheduleVideoCameraInUsePoll = () => {
  clearVideoCameraInUsePoll();
  videoCameraInUseTimer = setTimeout(async () => {
    videoCameraInUseTimer = null;
    if (!videoCameraInUse || typeof videoCameraInUsePollAttempt !== 'function') return;
    const result = await videoCameraInUsePollAttempt(true);
    if (result === true) {
      videoCameraInUse = false;
      clearVideoCameraInUsePoll();
    } else if (videoCameraInUse) {
      scheduleVideoCameraInUsePoll();
    }
  }, 3000);
};

const reportCameraAcquireError = (err, toast) => {
  const errName = err?.name || '';

  if (errName === 'NotReadableError' || errName === 'TrackStartError') {
    if (!videoCameraInUse) {
      toast('Camera is in use by another application', 'error');
    }
    videoCameraInUse = true;
    scheduleVideoCameraInUsePoll();
    return 'camera-in-use';
  }

  if (errName === 'NotAllowedError') {
    videoRetryFailed = true;
    videoRetryLastFailedAt = Date.now();
    toast('Camera permission denied. Please allow camera in browser settings', 'error');
    return false;
  }

  if (errName === 'NotFoundError') {
    videoRetryFailed = true;
    videoRetryLastFailedAt = Date.now();
    toast('No camera found on this device', 'error');
    return false;
  }

  videoRetryFailed = true;
  videoRetryLastFailedAt = Date.now();
  toast('Camera unavailable, please try again', 'error');
  return false;
};

/** Queue a renegotiation offer once pc returns to stable state.
 *  Uses a simple polling mechanism with a guard to prevent duplicate tasks per peer.
 */
const pendingRenegotiationPeers = new Set();
const queueRenegotiationWhenStable = (pc, peerId, sendOfferFn, label, maxWaitMs = 5000) => {
  const taskKey = `${peerId}:${label}`;
  if (pendingRenegotiationPeers.has(taskKey)) return;

  if (pc.signalingState === 'stable') {
    sendOfferFn(pc, peerId, label);
    return;
  }

  pendingRenegotiationPeers.add(taskKey);
  const start = Date.now();
  const poll = () => {
    if (pc.signalingState === 'closed') {
      pendingRenegotiationPeers.delete(taskKey);
      return;
    }
    if (pc.signalingState === 'stable') {
      pendingRenegotiationPeers.delete(taskKey);
      sendOfferFn(pc, peerId, label);
      return;
    }
    if (Date.now() - start < maxWaitMs) {
      setTimeout(poll, 200);
    } else {
      pendingRenegotiationPeers.delete(taskKey);
      mediaLog.warn('signaling', `[RENEGOTIATION-TIMEOUT] ${label} for ${peerId}`);
    }
  };
  setTimeout(poll, 200);
};

/** Survives Strict Mode remount — one conferencing bootstrap per room + peer set. */
const conferencingSession = {
  roomId: null,
  peerKey: null,
  bootstrapPromise: null,
  hasStarted: false,
};

const resetConferencingSession = (roomId = null) => {
  if (roomId && conferencingSession.roomId !== roomId) return;
  conferencingSession.roomId = null;
  conferencingSession.peerKey = null;
  conferencingSession.bootstrapPromise = null;
  conferencingSession.hasStarted = false;
};

const streamHasLiveTracks = (stream) =>
  Boolean(stream?.getTracks().some((t) => t.readyState === 'live'));

const logMediaLifecycle = (message, extra) => {
  if (import.meta.env.DEV) {
    mediaLog.debug('media', message, extra);
  }
};

const releaseLocalMediaSingleton = (reason) => {
  logMediaLifecycle('releaseLocalStream called', { reason });
  if (pendingMediaReleaseTimer) {
    clearTimeout(pendingMediaReleaseTimer);
    pendingMediaReleaseTimer = null;
  }
  const releasedRoomId = localMediaSingleton.roomId;
  localMediaSingleton.initPromise = null;
  localMediaSingleton.failed = false;
  localMediaSingleton.roomId = null;
  resetConferencingSession(releasedRoomId);
  if (localMediaSingleton.stream) {
    localMediaSingleton.stream.getTracks().forEach((t) => t.stop());
    localMediaSingleton.stream = null;
  }
};

/** Deferred release — Strict Mode remount bumps retain count back before this runs. */
const scheduleReleaseIfNoConsumers = (reason) => {
  if (pendingMediaReleaseTimer) {
    clearTimeout(pendingMediaReleaseTimer);
  }
  pendingMediaReleaseTimer = setTimeout(() => {
    pendingMediaReleaseTimer = null;
    if (useWebRTCMediaRetainCount === 0) {
      releaseLocalMediaSingleton(reason);
    } else if (import.meta.env.DEV) {
      logMediaLifecycle('releaseLocalStream skipped — hook remounted', {
        reason,
        retainCount: useWebRTCMediaRetainCount,
      });
    }
  }, 0);
};

/**
 * Resolve OUR outbound RTCRtpSender for a media kind.
 * Never return a sender whose track is the wrong kind; never grab an arbitrary empty slot.
 */
const getSenderByKind = (pc, kind) => {
  if (!pc) return null;

  const transceivers = pc.getTransceivers().filter((tc) => !tc.stopped);

  // 1. Sender already bound to a live track of this kind.
  const withOurTrack = transceivers.find((tc) => tc.sender?.track?.kind === kind);
  if (withOurTrack?.sender) return withOurTrack.sender;

  // 2. Empty sender on m-line tagged via mid (e.g. "audio0", "video1").
  const midSlot = transceivers.find((tc) => {
    if (tc.sender?.track) return false;
    const mid = String(tc.mid ?? '').toLowerCase();
    return mid.includes(kind);
  });
  if (midSlot?.sender) return midSlot.sender;

  // 3. Empty sender on the negotiated m-line for this media type (slot id via remote m-line only).
  const mLineSlot = transceivers.find((tc) => {
    if (tc.sender?.track) return false;
    return tc.receiver?.track?.kind === kind;
  });
  if (mLineSlot?.sender) return mLineSlot.sender;

  // 4. Orphan sender with no track and no conflicting m-line occupant.
  const orphan = pc.getSenders().find((s) => {
    if (s.track) return s.track.kind === kind;
    const tc = transceivers.find((t) => t.sender === s);
    if (!tc) return true;
    if (tc.sender?.track) return false;
    const mid = String(tc.mid ?? '').toLowerCase();
    if (mid.includes(kind === 'audio' ? 'video' : 'audio')) return false;
    if (tc.receiver?.track?.kind && tc.receiver.track.kind !== kind) return false;
    return true;
  });
  return orphan ?? null;
};

const getVideoSender = (pc) => getSenderByKind(pc, 'video');

const getAudioSender = (pc) => getSenderByKind(pc, 'audio');

const logSenderState = (peerId, pc, label) => {
  if (!import.meta.env.DEV || !pc) return;
  mediaLog.debug('track', label, {
    peer: peerId,
    senders: pc.getSenders().map((s) => ({
      kind: s.track?.kind ?? 'none',
      enabled: s.track?.enabled,
      readyState: s.track?.readyState,
      hasTrack: !!s.track,
    })),
    transceivers: pc.getTransceivers().map((tc) => ({
      mid: tc.mid,
      senderKind: tc.sender?.track?.kind ?? 'none',
      receiverKind: tc.receiver?.track?.kind ?? 'none',
      direction: tc.direction,
      currentDirection: tc.currentDirection,
    })),
  });
};

/** Deep diagnostics for outbound RTP flow. */
const logOutboundRtpStats = async (pc, peerId, label = 'diagnostic') => {
  if (!pc || pc.signalingState === 'closed') return;
  try {
    const stats = await pc.getStats();
    let videoOutbound = null;
    let audioOutbound = null;

    stats.forEach((report) => {
      if (report.type === 'outbound-rtp') {
        if (report.kind === 'video') videoOutbound = report;
        if (report.kind === 'audio') audioOutbound = report;
      }
    });

    const vActive = (videoOutbound?.packetsSent ?? 0) > 0;
    const aActive = (audioOutbound?.packetsSent ?? 0) > 0;

    const senderSnapshot = (kind) => {
      const sender = kind === 'audio' ? getAudioSender(pc) : getVideoSender(pc);
      const track = sender?.track;
      return {
        hasSender: !!sender,
        trackId: track?.id,
        trackKind: track?.kind,
        trackEnabled: track?.enabled,
        trackReadyState: track?.readyState,
      };
    };

    if (videoOutbound || audioOutbound) {
      mediaLog.info('stats', `[RTP-DIAG] ${label}`, {
        peer: peerId,
        video: videoOutbound ? {
          packets: videoOutbound.packetsSent,
          bytes: videoOutbound.bytesSent,
          frames: videoOutbound.framesSent,
          active: vActive,
          sender: senderSnapshot('video'),
        } : 'none',
        audio: audioOutbound ? {
          packets: audioOutbound.packetsSent,
          bytes: audioOutbound.bytesSent,
          active: aActive,
          sender: senderSnapshot('audio'),
        } : 'none',
      });
    }

    if (import.meta.env.DEV) {
      ['audio', 'video'].forEach((kind) => {
        const outbound = kind === 'video' ? videoOutbound : audioOutbound;
        const snap = senderSnapshot(kind);
        if (snap.trackEnabled && snap.trackReadyState === 'live' && (outbound?.packetsSent ?? 0) === 0) {
          mediaLog.warn('stats', `[RTP-DIAG] ${kind} enabled but packetsSent=0 — sender binding likely broken`, {
            peer: peerId,
            label,
            sender: snap,
          });
        }
      });
    }

    pc.getTransceivers().forEach((tc) => {
      const kind = tc.sender?.track?.kind || tc.receiver?.track?.kind;
      if (kind) {
        mediaLog.info('stats', `[TRANSCEIVER-DIAG] ${label}`, {
          peer: peerId,
          kind,
          mid: tc.mid,
          direction: tc.direction,
          currentDirection: tc.currentDirection,
          transport: tc.sender.transport?.state,
        });
      }
    });
  } catch (err) {
    mediaLog.warn('stats', `[RTP-DIAG] failed`, err?.message);
  }
};

/**
 * Sync local tracks and transceiver directions to match current intent.
 * This is the core WebRTC lifecycle management function.
 */
const syncLocalMediaToPc = async (pc, tracks, peerId, resolveSenderFn, rememberSenderFn) => {
  if (!pc || !tracks || !Array.isArray(tracks)) return;

  for (const { kind, track, stream } of tracks) {
    let sender = resolveSenderFn(pc, peerId, kind);
    if (sender?.track && sender.track.kind !== kind) {
      mediaLog.warn('signaling', `[LIFECYCLE] ${kind} sender kind mismatch — re-resolving`, {
        peerId,
        senderTrackKind: sender.track.kind,
      });
      sender = getSenderByKind(pc, kind);
    }

    const shouldSend =
      track && track.readyState === 'live' && track.kind === kind && track.enabled !== false;

    if (shouldSend) {
      if (!sender) {
        sender = pc.addTrack(track, stream);
        rememberSenderFn(peerId, kind, sender);
        mediaLog.info('signaling', `[LIFECYCLE] ${kind} track added via addTrack`, { peerId });
      } else if (sender.track !== track) {
        await sender.replaceTrack(track);
        rememberSenderFn(peerId, kind, sender);
        mediaLog.info('signaling', `[LIFECYCLE] ${kind} track updated via replaceTrack`, {
          peerId,
          trackId: track.id,
        });
      }

      const tc = pc.getTransceivers().find((t) => t.sender === sender);
      if (tc && tc.direction !== 'sendrecv' && tc.direction !== 'sendonly') {
        tc.direction = 'sendrecv';
        mediaLog.info('signaling', `[LIFECYCLE] ${kind} direction requested upgrade to sendrecv`, { peerId });
      }

      if (import.meta.env.DEV && sender.track !== track) {
        mediaLog.warn('signaling', `[LIFECYCLE] ${kind} sender.track !== local track after bind`, {
          peerId,
          senderTrackId: sender.track?.id,
          localTrackId: track.id,
        });
      }
    } else if (track && track.readyState === 'live' && track.kind === kind) {
      // Live but muted/disabled — keep sender bound so unmute does not require renegotiation.
      if (sender && sender.track !== track) {
        await sender.replaceTrack(track);
        rememberSenderFn(peerId, kind, sender);
      } else if (!sender) {
        sender = pc.addTrack(track, stream);
        rememberSenderFn(peerId, kind, sender);
      }
      const tc = pc.getTransceivers().find((t) => t.sender === sender);
      if (tc && tc.direction !== 'sendrecv' && tc.direction !== 'sendonly') {
        tc.direction = 'sendrecv';
      }
    } else {
      const tc = sender ? pc.getTransceivers().find((t) => t.sender === sender) : null;

      if (tc && (tc.direction === 'sendrecv' || tc.direction === 'sendonly')) {
        tc.direction = 'recvonly';
        mediaLog.info('signaling', `[LIFECYCLE] ${kind} direction downgraded to recvonly`, { peerId });
      }
      if (sender?.track) {
        if (sender.track.readyState !== 'live') {
          await sender.replaceTrack(null);
          mediaLog.info('signaling', `[LIFECYCLE] ${kind} track cleared (null)`, { peerId });
        }
      } else if (!track && sender) {
        await sender.replaceTrack(null);
        mediaLog.info('signaling', `[LIFECYCLE] ${kind} track cleared (no local track)`, { peerId });
      }
    }
  }
};

const isPolitePeer = (localSocketId, remoteSocketId) => localSocketId > remoteSocketId;

/** Lower socket id initiates offers so each pair has exactly one offerer. */
const shouldInitiateOffer = (localSocketId, remoteSocketId) =>
  String(localSocketId) < String(remoteSocketId);

/** Remote UI sync from received tracks — track.enabled is the mute/camera signal. */
const isTrackTransmitting = (track) => {
  if (!track) return true;
  return track.readyState === 'live' && track.enabled !== false;
};

/** Prefer a live camera track — never use ended/stale tracks at index 0. */
const getLiveLocalVideoTrack = (stream) =>
  stream?.getVideoTracks().find((t) => t.readyState === 'live') ?? null;

const getLiveLocalAudioTrack = (stream) =>
  stream?.getAudioTracks().find((t) => t.readyState === 'live') ?? null;

const removeStaleLocalVideoTracks = (stream) => {
  if (!stream) return;
  [...stream.getVideoTracks()].forEach((track) => {
    if (track.readyState === 'live') return;
    stream.removeTrack(track);
    track.stop();
  });
};

const getOutgoingVideoTrack = (isSharingScreen, screenTrack, localStream) => {
  if (isSharingScreen && screenTrack) return screenTrack;
  return getLiveLocalVideoTrack(localStream);
};

/** Sync attach — use prepareLocalTracksForNegotiation before createOffer/createAnswer when possible. */
const ensureLocalTracksOnPc = (pc, stream) => {
  if (!pc || !stream) return;

  const audioTrack = stream.getAudioTracks().find((t) => t.readyState === 'live');
  const videoTrack = stream.getVideoTracks().find((t) => t.readyState === 'live');
  const tracks = [audioTrack, videoTrack].filter(Boolean);

  tracks.forEach((track) => {
    const sender = getSenderByKind(pc, track.kind);
    if (!sender) {
      pc.addTrack(track, stream);
      if (import.meta.env.DEV) {
        mediaLog.debug('track', `addTrack(${track.kind}) on peer connection`);
      }
    } else if (!sender.track) {
      sender.replaceTrack(track).catch((err) => {
        mediaLog.warn('track', `restore ${track.kind} sender`, err?.message);
      });
    } else if (sender.track !== track) {
      if (import.meta.env.DEV) {
        mediaLog.debug('track', `replaceTrack(${track.kind}) — identity changed`);
      }
      sender.replaceTrack(track).catch((err) => {
        mediaLog.warn('track', `replaceTrack(${track.kind}) failed`, err?.message);
      });
    }
  });
};

const MEDIA_DC_LABEL = 'media-state';

const upsertTrackOnStream = (prevStream, track) => {
  const stream = prevStream ? new MediaStream(prevStream.getTracks()) : new MediaStream();
  stream.getTracks()
    .filter((t) => t.kind === track.kind)
    .forEach((t) => stream.removeTrack(t));
  stream.addTrack(track);
  return stream;
};

export const useWebRTC = (roomId, initialMicOn = false, initialVideoOn = false) => {
  const { toast } = useToast();
  const [localStream, setLocalStream] = useState(null);
  const [screenStream, setScreenStream] = useState(null);
  const [remoteStreams, setRemoteStreams] = useState({});
  const [remoteScreenStreams, setRemoteScreenStreams] = useState({});
  const [presenter, setPresenter] = useState(null);
  const [peerNames, setPeerNames] = useState({});
  const [isMicOn, setIsMicOn] = useState(initialMicOn);
  const [isVideoOn, setIsVideoOn] = useState(initialVideoOn);
  const [localMediaRevision, setLocalMediaRevision] = useState(0);
  const [peerMediaState, setPeerMediaState] = useState({});
  const [socket, setSocket] = useState(() => socketService.getSocket());

  const peerConnections = useRef({});
  const localStreamRef = useRef(null);
  const screenStreamRef = useRef(null);
  const screenTrackRef = useRef(null);
  const presenterRef = useRef(null);
  const negotiatedPeersRef = useRef(new Set());
  const isSharingScreenRef = useRef(false);
  const makingOfferRef = useRef(new Set());
  const dataChannelsRef = useRef({});
  const trackListenerCleanupRef = useRef({});
  const remoteListenerTrackIdsRef = useRef({});
  const appliedRemoteTrackIdsRef = useRef({});
  const socketRef = useRef(socket);
  const isMicOnRef = useRef(initialMicOn);
  const isVideoOnRef = useRef(initialVideoOn);

  // When the roomId first becomes live (pre-join → room transition), sync refs and
  // React state to the values chosen on the pre-join screen. The useState initializers
  // already seed the values correctly for the first mount; this effect handles the
  // case where roomId transitions from null → actual roomId after setup is done.
  useEffect(() => {
    if (roomId) {
      isMicOnRef.current = initialMicOn;
      isVideoOnRef.current = initialVideoOn;
      setIsMicOn(initialMicOn);
      setIsVideoOn(initialVideoOn);
    }
    // Only re-run when roomId changes (i.e., on room entry). initialMicOn/initialVideoOn
    // are stable after the pre-join screen commits — they won't flip during the session.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const connectToPeerRef = useRef(null);
  const syncAnswererOutboundRef = useRef(null);
  const ensureMediaDataChannelRef = useRef(() => { });
  const localVideoTrackRef = useRef(null);
  const pendingMediaStatePayloadRef = useRef(null);
  const localTrackListenersCleanupRef = useRef(null);
  const signalingHandlersRef = useRef({});
  const peersInitiatedRef = useRef(new Set());
  const peerSenderSlotsRef = useRef({});

  useEffect(() => {
    socketRef.current = socket;
  }, [socket]);

  useEffect(() => {
    const existing = socketService.getSocket() || socketService.connect();
    setSocket(existing);
    return socketService.subscribe((nextSocket) => {
      setSocket(nextSocket);
    });
  }, []);

  useEffect(() => {
    presenterRef.current = presenter;
  }, [presenter]);

  const rememberPeerName = useCallback((socketId, name) => {
    if (!socketId || !name) return;
    setPeerNames((prev) => (prev[socketId] === name ? prev : { ...prev, [socketId]: name }));
  }, []);

  const readLocalMediaFlags = useCallback(() => {
    const stream = localStreamRef.current;
    const audioTrack = getLiveLocalAudioTrack(stream);
    const videoTrack = getLiveLocalVideoTrack(stream);
    return {
      mic: audioTrack ? audioTrack.enabled : isMicOnRef.current,
      video: videoTrack ? videoTrack.enabled : isVideoOnRef.current,
    };
  }, []);

  const attachLocalTrackListeners = useCallback((stream) => {
    localTrackListenersCleanupRef.current?.();
    if (!stream) return;

    const bumpFromTracks = () => {
      const { mic, video } = readLocalMediaFlags();
      if (mic !== isMicOnRef.current) {
        isMicOnRef.current = mic;
        setIsMicOn(mic);
      }
      if (video !== isVideoOnRef.current) {
        isVideoOnRef.current = video;
        setIsVideoOn(video);
      }
      setLocalMediaRevision((n) => n + 1);
    };

    const cleanups = [];
    stream.getTracks().forEach((track) => {
      ['mute', 'unmute', 'ended'].forEach((eventName) => {
        track.addEventListener(eventName, bumpFromTracks);
        cleanups.push(() => track.removeEventListener(eventName, bumpFromTracks));
      });
    });
    localTrackListenersCleanupRef.current = () => cleanups.forEach((fn) => fn());
  }, [readLocalMediaFlags]);

  /** Single source of truth for mute/camera — only toggles track.enabled on local tracks. */
  const applyLocalTrackEnabledFlags = useCallback(() => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const audioTrack = getLiveLocalAudioTrack(stream);
    const cameraTrack = getLiveLocalVideoTrack(stream);
    if (audioTrack) {
      audioTrack.enabled = isMicOnRef.current;
    }
    if (cameraTrack) {
      cameraTrack.enabled = isVideoOnRef.current;
    }

    if (import.meta.env.DEV) {
      mediaLog.debug('track', 'Local track.enabled', {
        mic: audioTrack?.enabled,
        camera: cameraTrack?.enabled,
        sharing: isSharingScreenRef.current,
      });
    }
  }, []);

  const rememberOutboundSender = useCallback((peerId, kind, sender) => {
    if (!peerId || !sender) return;
    if (!peerSenderSlotsRef.current[peerId]) {
      peerSenderSlotsRef.current[peerId] = {};
    }
    peerSenderSlotsRef.current[peerId][kind] = sender;
  }, []);

  const resolveOutboundSender = useCallback((pc, peerId, kind) => {
    const cached = peerSenderSlotsRef.current[peerId]?.[kind];
    if (cached && pc.getSenders().includes(cached)) {
      if (!cached.track || cached.track.kind === kind) return cached;
      mediaLog.warn('track', `resolveOutboundSender(${kind}) stale cache`, {
        peer: peerId,
        cachedKind: cached.track?.kind,
      });
      delete peerSenderSlotsRef.current[peerId]?.[kind];
    }
    const resolved = getSenderByKind(pc, kind);
    if (resolved?.track && resolved.track.kind !== kind) {
      mediaLog.warn('track', `resolveOutboundSender(${kind}) kind mismatch`, {
        peer: peerId,
        senderTrackKind: resolved.track.kind,
      });
      return null;
    }
    if (resolved) rememberOutboundSender(peerId, kind, resolved);
    return resolved;
  }, [rememberOutboundSender]);

  const clearOutboundSenderCache = useCallback((peerId) => {
    if (peerId) {
      delete peerSenderSlotsRef.current[peerId];
    }
  }, []);

  const sendOffer = useCallback(
    async (pc, targetSocketId, label = 'offer') => {
      const activeSocket = socketRef.current;
      if (!activeSocket || !pc) return false;

      if (pc.signalingState !== 'stable') {
        mediaLog.debug('signaling', `Skip ${label} — not stable`, {
          peer: targetSocketId,
          state: pc.signalingState,
        });
        return false;
      }
      if (makingOfferRef.current.has(targetSocketId)) return false;

      try {
        makingOfferRef.current.add(targetSocketId);

        // CRITICAL: Log all transceiver directions immediately before createOffer
        // so we can confirm sendrecv is set. If any transceiver is recvonly/inactive,
        // the remote peer will never receive that media.
        if (import.meta.env.DEV) {
          pc.getTransceivers().forEach((tc) => {
            mediaLog.info('signaling', `[SDP-DIRECTION-PRE-OFFER] ${label}`, {
              peer: targetSocketId,
              senderKind: tc.sender?.track?.kind ?? 'none',
              receiverKind: tc.receiver?.track?.kind ?? 'none',
              direction: tc.direction,
              currentDirection: tc.currentDirection,
              senderTrackLive: tc.sender?.track?.readyState === 'live',
              senderTrackEnabled: tc.sender?.track?.enabled,
            });
          });
        }

        const offer = await pc.createOffer();

        // Log the actual SDP directions in the generated offer.
        if (import.meta.env.DEV) {
          const sdpLines = offer.sdp?.split('\n') ?? [];
          const directionLines = sdpLines.filter((l) =>
            l.includes('sendrecv') || l.includes('sendonly') ||
            l.includes('recvonly') || l.includes('inactive')
          );
          mediaLog.info('signaling', `[SDP-DIRECTION-IN-OFFER] ${label}`, {
            peer: targetSocketId,
            directions: directionLines.map((l) => l.trim()),
          });
        }

        await pc.setLocalDescription(offer);

        mediaLog.info('media', '[DEBUG-SIGNAL] offer emitted', {
          to: targetSocketId,
          sdpType: offer?.type,
        });

        activeSocket.emit('offer', { roomId, targetSocketId, sdp: offer });
        mediaLog.debug('signaling', `${label} sent`, targetSocketId);
        return true;
      } catch (err) {
        mediaLog.error('signaling', `${label} failed for ${targetSocketId}`, err?.message);
        return false;
      } finally {
        makingOfferRef.current.delete(targetSocketId);
      }
    },
    [roomId],
  );

  const renegotiateAll = useCallback(
    async (reason) => {
      const entries = Object.entries(peerConnections.current);
      mediaLog.debug('signaling', `Renegotiate (${reason})`, { peers: entries.length });

      await Promise.all(
        entries.map(async ([targetSocketId, pc]) => {
          const stream = localStreamRef.current;
          if (stream) {
            try {
              await prepareLocalTracksForNegotiation(pc, stream, targetSocketId);
            } catch (err) {
              mediaLog.warn('signaling', 'renegotiateAll prepare failed', err?.message);
            }
          }
          await sendOffer(pc, targetSocketId, 'renegotiation');
        }),
      );
    },
    [sendOffer],
  );

  /**
   * MUST run before createOffer/createAnswer so SDP includes local tracks.
   * Same path for offerer and answerer — prevents one-sided media.
   */
  const prepareLocalTracksForNegotiation = useCallback(
    async (pc, stream, peerId) => {
      applyLocalTrackEnabledFlags();

      const audioTrack = getLiveLocalAudioTrack(stream);
      const videoTrack = getOutgoingVideoTrack(
        isSharingScreenRef.current,
        screenTrackRef.current,
        stream,
      );
      const videoStream = (isSharingScreenRef.current && screenStreamRef.current)
        ? screenStreamRef.current
        : stream;

      const tracks = [
        { kind: 'audio', track: audioTrack, stream },
        { kind: 'video', track: videoTrack, stream: videoStream },
      ];

      clearOutboundSenderCache(peerId);
      await syncLocalMediaToPc(pc, tracks, peerId, resolveOutboundSender, rememberOutboundSender);
      logSenderState(peerId, pc, 'prepareLocalTracksForNegotiation');
      setTimeout(() => logOutboundRtpStats(pc, peerId, 'post-prepare'), 1000);
    },
    [applyLocalTrackEnabledFlags, resolveOutboundSender, rememberOutboundSender, clearOutboundSenderCache],
  );

  /** Re-bind live video to all peer senders after camera-off left replaceTrack(null). */
  const restoreRemoteVideoSenders = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    const videoTrack = getOutgoingVideoTrack(
      isSharingScreenRef.current,
      screenTrackRef.current,
      stream,
    );
    if (!videoTrack || videoTrack.readyState !== 'live') return;

    const videoStream =
      isSharingScreenRef.current && screenStreamRef.current ? screenStreamRef.current : stream;

    await Promise.all(
      Object.entries(peerConnections.current).map(async ([peerId, pc]) => {
        if (pc.signalingState === 'closed') return;

        let sender = resolveOutboundSender(pc, peerId, 'video') ?? getVideoSender(pc);
        if (!sender) {
          sender = pc.addTrack(videoTrack, videoStream);
          rememberOutboundSender(peerId, 'video', sender);
        } else if (sender.track !== videoTrack) {
          try {
            await sender.replaceTrack(videoTrack);
            rememberOutboundSender(peerId, 'video', sender);
          } catch (err) {
            mediaLog.warn('media', 'restoreRemoteVideoSenders replaceTrack failed', err?.message);
          }
        }

        const tc =
          pc.getTransceivers().find((t) => t.sender === sender) ??
          pc.getTransceivers().find(
            (t) => t.sender?.track?.kind === 'video' || t.receiver?.track?.kind === 'video',
          );
        if (tc && tc.direction !== 'sendrecv' && tc.direction !== 'sendonly') {
          tc.direction = 'sendrecv';
        }

        mediaLog.info('media', 'Remote video sender restored', {
          peerId,
          trackId: videoTrack.id,
          direction: tc?.direction,
          currentDirection: tc?.currentDirection,
        });
      }),
    );
  }, [resolveOutboundSender, rememberOutboundSender]);

  /**
   * Recovery only — never replaceTrack after SDP when sender already has the correct local track.
   * Mute/camera toggles use track.enabled only.
   */
  const repairOutboundSendersIfNeeded = useCallback(async () => {
    const stream = localStreamRef.current;
    if (!stream) return;

    applyLocalTrackEnabledFlags();

    const audioTrack = getLiveLocalAudioTrack(stream);
    const videoTrack = getOutgoingVideoTrack(
      isSharingScreenRef.current,
      screenTrackRef.current,
      stream,
    );
    const videoStream = (isSharingScreenRef.current && screenStreamRef.current)
      ? screenStreamRef.current
      : stream;

    await Promise.all(
      Object.entries(peerConnections.current).map(async ([peerId, pc]) => {
        if (pc.signalingState !== 'stable') return;

        const tracks = [
          { kind: 'audio', track: audioTrack, stream },
          { kind: 'video', track: videoTrack, stream: videoStream },
        ];

        // Capture initial directions to detect changes.
        const initialDirections = pc.getTransceivers().map((tc) => ({
          kind: tc.sender?.track?.kind || tc.receiver?.track?.kind,
          direction: tc.direction,
        }));

        await syncLocalMediaToPc(pc, tracks, peerId, resolveOutboundSender, rememberOutboundSender);

        // If any direction was upgraded to sendrecv, we MUST renegotiate to activate the transport.
        const finalDirections = pc.getTransceivers().map((tc) => ({
          kind: tc.sender?.track?.kind || tc.receiver?.track?.kind,
          direction: tc.direction,
        }));

        const changed = finalDirections.some((final, idx) => {
          const prev = initialDirections[idx];
          const tc = pc.getTransceivers()[idx];
          if (!tc) return false;

          const directionChanged = prev && final.direction !== prev.direction && final.direction === 'sendrecv';
          // Repair: if we intend to send but negotiation resulted in a non-sending direction, renegotiate.
          const mismatch = tc.direction === 'sendrecv' && tc.currentDirection === 'recvonly';

          return directionChanged || mismatch;
        });

        if (changed) {
          mediaLog.info('signaling', '[REPAIR] Direction mismatch or change detected, queueing negotiation', { peerId });
          // Use 'negotiationneeded' label to consolidate with other triggers.
          queueRenegotiationWhenStable(pc, peerId, async (pcArg, peerIdArg, labelArg) => {
            const s = localStreamRef.current;
            if (s) {
              try {
                await prepareLocalTracksForNegotiation(pcArg, s, peerIdArg);
              } catch (e) {
                mediaLog.warn('signaling', '[REPAIR] prepare failed', e?.message);
              }
            }
            return sendOffer(pcArg, peerIdArg, labelArg);
          }, 'negotiationneeded');
        }

        logSenderState(peerId, pc, 'repairOutboundSenders');
      }),
    );
  }, [applyLocalTrackEnabledFlags, resolveOutboundSender, rememberOutboundSender, prepareLocalTracksForNegotiation, sendOffer]);

  /**
   * Answerer (joiner) must bind local tracks on correct senders + renegotiate.
   * track.enabled alone does not fix recvonly senders or wrong m-line binding.
   */
  const syncAnswererOutboundAfterMediaToggle = useCallback(async () => {
    if (answererOutboundSyncInProgress) return;
    answererOutboundSyncInProgress = true;
    try {
      const localSocketId = socketRef.current?.id;
      const stream = localStreamRef.current;
      if (!localSocketId || !stream) return;

      const answererPeers = Object.entries(peerConnections.current).filter(
        ([peerId]) => !shouldInitiateOffer(localSocketId, peerId),
      );
      if (answererPeers.length === 0) return;

      const audioTrack = getLiveLocalAudioTrack(stream);
      const videoTrack = getOutgoingVideoTrack(
        isSharingScreenRef.current,
        screenTrackRef.current,
        stream,
      );

      await Promise.all(
        answererPeers.map(async ([peerId, pc]) => {
          if (pc.signalingState === 'closed') return;

          try {
            clearOutboundSenderCache(peerId);
            await prepareLocalTracksForNegotiation(pc, stream, peerId);
          } catch (err) {
            mediaLog.warn('signaling', '[JOINER-OUTBOUND] prepare failed', err?.message);
            return;
          }

          try {
            pc.getTransceivers().forEach(transceiver => {
              const hasLiveSenderTrack =
                transceiver.sender?.track?.readyState === 'live';
              if (hasLiveSenderTrack && transceiver.direction !== 'sendrecv') {
                transceiver.direction = 'sendrecv';
                mediaLog.info('media', '[TRANSCEIVER] direction forced sendrecv', {
                  peerId,
                  kind: transceiver.sender.track.kind,
                });
              }
            });
          } catch (err) {
            mediaLog.warn('media', '[TRANSCEIVER] direction fix failed', {
              peerId,
              err: err.message,
            });
          }

          if (import.meta.env.DEV) {
            const audioSender = getSenderByKind(pc, 'audio');
            const videoSender = getSenderByKind(pc, 'video');
            mediaLog.info('track', '[JOINER-OUTBOUND] sender bind verify', {
              peer: peerId,
              audio: {
                localTrackId: audioTrack?.id,
                senderTrackId: audioSender?.track?.id,
                sameRef: audioSender?.track === audioTrack,
                enabled: audioSender?.track?.enabled,
              },
              video: {
                localTrackId: videoTrack?.id,
                senderTrackId: videoSender?.track?.id,
                sameRef: videoSender?.track === videoTrack,
                enabled: videoSender?.track?.enabled,
              },
            });
            pc.getTransceivers().forEach((tc) => {
              const kind = tc.sender?.track?.kind;
              if (!kind) return;
              mediaLog.info('track', '[JOINER-OUTBOUND] transceiver after bind', {
                peer: peerId,
                kind,
                direction: tc.direction,
                currentDirection: tc.currentDirection,
                senderTrackId: tc.sender?.track?.id,
              });
            });
            setTimeout(() => logOutboundRtpStats(pc, peerId, 'post-answerer-toggle'), 1500);
          }

          mediaLog.info('signaling', '[JOINER-OUTBOUND] renegotiation queued', { peer: peerId });
          queueRenegotiationWhenStable(
            pc,
            peerId,
            async (pcArg, peerIdArg, labelArg) => {
              try {
                await prepareLocalTracksForNegotiation(pcArg, stream, peerIdArg);
              } catch (prepErr) {
                mediaLog.warn('signaling', '[JOINER-OUTBOUND] prepare before offer failed', prepErr?.message);
              }
              const sent = await sendOffer(pcArg, peerIdArg, labelArg);
              if (sent) {
                setTimeout(() => logOutboundRtpStats(pcArg, peerIdArg, 'post-joiner-offer'), 2000);
              }
              return sent;
            },
            'answerer-media-toggle',
          );
        }),
      );
    } finally {
      answererOutboundSyncInProgress = false;
    }
  }, [prepareLocalTracksForNegotiation, sendOffer, clearOutboundSenderCache]);

  syncAnswererOutboundRef.current = syncAnswererOutboundAfterMediaToggle;

  /** Offerer renegotiation + answerer sync after live video is restored on senders. */
  const syncOutboundAfterCameraOn = useCallback(async () => {
    const localSocketId = socketRef.current?.id;
    const stream = localStreamRef.current;
    if (!localSocketId || !stream) return;

    await restoreRemoteVideoSenders();

    await Promise.all(
      Object.entries(peerConnections.current).map(async ([peerId, pc]) => {
        if (pc.signalingState === 'closed') return;
        if (!shouldInitiateOffer(localSocketId, peerId)) return;

        try {
          clearOutboundSenderCache(peerId);
          await prepareLocalTracksForNegotiation(pc, stream, peerId);
        } catch (err) {
          mediaLog.warn('signaling', '[CAMERA-ON] offerer prepare failed', err?.message);
          return;
        }

        queueRenegotiationWhenStable(
          pc,
          peerId,
          async (pcArg, peerIdArg, labelArg) => {
            try {
              await prepareLocalTracksForNegotiation(pcArg, stream, peerIdArg);
            } catch (prepErr) {
              mediaLog.warn('signaling', '[CAMERA-ON] prepare before offer failed', prepErr?.message);
            }
            return sendOffer(pcArg, peerIdArg, labelArg);
          },
          'camera-on',
        );
      }),
    );

    await syncAnswererOutboundAfterMediaToggle();
  }, [
    restoreRemoteVideoSenders,
    prepareLocalTracksForNegotiation,
    sendOffer,
    clearOutboundSenderCache,
    syncAnswererOutboundAfterMediaToggle,
  ]);

  const syncLocalStreamFromSingleton = useCallback(() => {
    const stream = localMediaSingleton.stream;
    localStreamRef.current = stream;
    setLocalStream((prev) => (prev === stream ? prev : stream));
    return stream;
  }, []);

  const releaseLocalStream = useCallback((reason = 'manual') => {
    localTrackListenersCleanupRef.current?.();
    localTrackListenersCleanupRef.current = null;
    releaseLocalMediaSingleton(reason);
    localStreamRef.current = null;
    setLocalStream(null);
  }, []);

  const hasLiveLocalStream = useCallback(
    () => streamHasLiveTracks(localMediaSingleton.stream ?? localStreamRef.current),
    [],
  );

  const initLocalStream = useCallback(async () => {
    const sessionRoomId = roomId ?? null;

    if (
      localMediaSingleton.stream &&
      localMediaSingleton.roomId === sessionRoomId &&
      streamHasLiveTracks(localMediaSingleton.stream)
    ) {
      logMediaLifecycle('initLocalStream reuse existing stream', { roomId: sessionRoomId });
      const stream = syncLocalStreamFromSingleton();
      if (!localTrackListenersCleanupRef.current) {
        attachLocalTrackListeners(stream);
      }
      return stream;
    }

    if (localMediaSingleton.initPromise && localMediaSingleton.roomId === sessionRoomId) {
      logMediaLifecycle('initLocalStream await existing promise', { roomId: sessionRoomId });
      const stream = await localMediaSingleton.initPromise;
      syncLocalStreamFromSingleton();
      return stream;
    }

    if (
      localMediaSingleton.failed &&
      localMediaSingleton.roomId === sessionRoomId &&
      !streamHasLiveTracks(localMediaSingleton.stream)
    ) {
      logMediaLifecycle('initLocalStream skipped — prior failure for room', { roomId: sessionRoomId });
      return null;
    }

    if (
      localMediaSingleton.stream &&
      localMediaSingleton.roomId &&
      localMediaSingleton.roomId !== sessionRoomId
    ) {
      releaseLocalMediaSingleton('room-switch');
    }

    logMediaLifecycle('initLocalStream start', { roomId: sessionRoomId });
    localMediaSingleton.roomId = sessionRoomId;
    localMediaSingleton.failed = false;

    localMediaSingleton.initPromise = (async () => {
      const audioConstraints = {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      };

      /** Returns true for errors that mean the camera specifically failed (not a permission denial). */
      const isVideoSourceError = (err) => {
        if (!err) return false;
        const name = err.name ?? '';
        const msg = (err.message ?? '').toLowerCase();
        return (
          name === 'NotReadableError' ||
          name === 'OverconstrainedError' ||
          name === 'AbortError' ||
          msg.includes('could not start video source') ||
          msg.includes('device in use') ||
          msg.includes('starting video failed')
        );
      };

      const startVideo = isVideoOnRef.current;
      const startMic = isMicOnRef.current;
      let videoAvailable = startVideo;

      try {
        let stream = null;

        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: startVideo ? {
              width: { ideal: 1280 },
              height: { ideal: 720 },
              facingMode: 'user'
            } : false,
            audio: audioConstraints,
          });
        } catch (avErr) {
          if (startVideo && isVideoSourceError(avErr)) {
            // Camera is locked / busy — degrade gracefully to audio-only.
            mediaLog.warn(
              'media',
              'video unavailable, retrying audio-only',
              avErr?.message || avErr,
            );
            videoAvailable = false;

            try {
              stream = await navigator.mediaDevices.getUserMedia({
                video: false,
                audio: audioConstraints,
              });
            } catch (audioErr) {
              // Even audio failed — full failure.
              localMediaSingleton.failed = true;
              mediaLog.error('media', 'getUserMedia failed (audio-only fallback also failed)', audioErr?.message || audioErr);
              return null;
            }
          } else {
            // Permission denied or other hard failure — don't retry.
            localMediaSingleton.failed = true;
            mediaLog.error('media', 'getUserMedia failed', avErr?.message || avErr);
            return null;
          }
        }

        // Race-condition guard: another call already resolved the stream while we were awaiting.
        if (
          localMediaSingleton.stream &&
          localMediaSingleton.roomId === sessionRoomId &&
          streamHasLiveTracks(localMediaSingleton.stream)
        ) {
          logMediaLifecycle('initLocalStream discard duplicate — live stream won race', {
            roomId: sessionRoomId,
          });
          stream.getTracks().forEach((t) => t.stop());
          return localMediaSingleton.stream;
        }

        localMediaSingleton.stream = stream;
        localStreamRef.current = stream;
        setLocalStream(stream);

        const audioTrack = stream.getAudioTracks()[0];
        const videoTrack = stream.getVideoTracks()[0];

        // Apply initial selected preference
        if (audioTrack) {
          audioTrack.enabled = startMic;
        }

        const micEnabled = audioTrack ? audioTrack.enabled : false;
        // If camera wasn't acquired, force video state to off so UI shows camera-off placeholder.
        const videoEnabled = (videoAvailable && videoTrack) ? videoTrack.enabled : false;
        isMicOnRef.current = micEnabled;
        isVideoOnRef.current = videoEnabled;
        setIsMicOn(micEnabled);
        setIsVideoOn(videoEnabled);
        attachLocalTrackListeners(stream);

        mediaLog.info('media', 'Local stream ready', {
          audio: !!audioTrack,
          video: !!videoTrack,
          videoAvailable,
          mic: micEnabled,
          videoOn: videoEnabled,
        });
        return stream;
      } finally {
        localMediaSingleton.initPromise = null;
      }
    })();

    const stream = await localMediaSingleton.initPromise;
    syncLocalStreamFromSingleton();
    return stream;
  }, [roomId, attachLocalTrackListeners, syncLocalStreamFromSingleton]);

  /**
   * Signaling paths must never start a new getUserMedia — only reuse room-join media
   * or await the singleton init promise that room join already started.
   */
  const awaitLocalStreamForSignaling = useCallback(async () => {
    if (streamHasLiveTracks(localMediaSingleton.stream)) {
      syncLocalStreamFromSingleton();
      return localMediaSingleton.stream;
    }
    if (streamHasLiveTracks(localStreamRef.current)) {
      return localStreamRef.current;
    }
    if (localMediaSingleton.initPromise) {
      logMediaLifecycle('signaling await room init promise (no new getUserMedia)', {
        roomId: localMediaSingleton.roomId,
      });
      // Timeout guard: don't hang forever if initLocalStream never resolves
      const timeoutMs = 5000;
      const result = await Promise.race([
        localMediaSingleton.initPromise,
        new Promise((resolve) => setTimeout(() => resolve('__timeout__'), timeoutMs)),
      ]);
      if (result === '__timeout__') {
        mediaLog.error('signaling', '[DEBUG-SIGNAL] awaitLocalStreamForSignaling timed out after 5s');
        return null;
      }
      const stream = result;
      if (streamHasLiveTracks(stream)) {
        syncLocalStreamFromSingleton();
        return stream;
      }
    }
    mediaLog.warn(
      'signaling',
      'No local stream for signaling — waiting for room join media init',
    );
    return null;
  }, [syncLocalStreamFromSingleton]);

  useEffect(() => {
    useWebRTCMediaRetainCount += 1;
    return () => {
      useWebRTCMediaRetainCount -= 1;
      scheduleReleaseIfNoConsumers('hook-unmount');
    };
  }, []);

  const initLocalStreamRef = useRef(initLocalStream);
  initLocalStreamRef.current = initLocalStream;

  useEffect(() => {
    if (!roomId) {
      releaseLocalStream('no-room');
      resetConferencingSession();
      return undefined;
    }

    if (
      localMediaSingleton.roomId === roomId &&
      (streamHasLiveTracks(localMediaSingleton.stream) || localMediaSingleton.initPromise)
    ) {
      logMediaLifecycle('room media init skipped — already ready or in flight', { roomId });
      syncLocalStreamFromSingleton();
      return undefined;
    }

    initLocalStreamRef.current();
    return undefined;
  }, [roomId, releaseLocalStream, syncLocalStreamFromSingleton]);

  useEffect(() => {
    if (!socket) return undefined;

    const onSocketConnect = () => {
      logMediaLifecycle('socket reconnect detected', {
        roomId,
        connected: socket.connected,
        hasLiveStream: streamHasLiveTracks(localMediaSingleton.stream),
      });

      // Re-join the room on the backend so signaling validation passes
      if (roomId && socket.connected) {
        socket.emit('join-room', { roomId }, (response) => {
          if (response?.ok || response?.rejoined) {
            logMediaLifecycle('room re-joined after reconnect', { roomId, rejoined: response?.rejoined });
          } else if (response?.pending) {
            logMediaLifecycle('room re-join pending approval', { roomId });
          } else {
            logMediaLifecycle('room re-join failed', { roomId, message: response?.message });
          }
        });
      }

      if (streamHasLiveTracks(localMediaSingleton.stream)) {
        syncLocalStreamFromSingleton();
      }
    };

    socket.on('connect', onSocketConnect);
    return () => {
      socket.off('connect', onSocketConnect);
    };
  }, [socket, roomId, syncLocalStreamFromSingleton]);

  const updatePeerMediaStateFromTrack = useCallback((peerSocketId, track) => {
    if (!track) return;
    setPeerMediaState((prev) => {
      const current = prev[peerSocketId] || { isMicOn: true, isVideoOn: true };
      const next = { ...current };
      if (track.kind === 'audio') {
        next.isMicOn = isTrackTransmitting(track);
      } else if (track.kind === 'video') {
        next.isVideoOn = isTrackTransmitting(track);
      }
      if (next.isMicOn === current.isMicOn && next.isVideoOn === current.isVideoOn) {
        return prev;
      }
      return { ...prev, [peerSocketId]: next };
    });
  }, []);

  const attachRemoteTrackListeners = useCallback(
    (peerSocketId, track) => {
      if (!track) return;
      if (!remoteListenerTrackIdsRef.current[peerSocketId]) {
        remoteListenerTrackIdsRef.current[peerSocketId] = new Set();
      }
      if (remoteListenerTrackIdsRef.current[peerSocketId].has(track.id)) {
        updatePeerMediaStateFromTrack(peerSocketId, track);
        return;
      }
      remoteListenerTrackIdsRef.current[peerSocketId].add(track.id);

      if (!trackListenerCleanupRef.current[peerSocketId]) {
        trackListenerCleanupRef.current[peerSocketId] = [];
      }
      const onChange = () => updatePeerMediaStateFromTrack(peerSocketId, track);
      ['mute', 'unmute', 'ended'].forEach((eventName) => {
        track.addEventListener(eventName, onChange);
        trackListenerCleanupRef.current[peerSocketId].push(() => {
          track.removeEventListener(eventName, onChange);
        });
      });
      onChange();
    },
    [updatePeerMediaStateFromTrack],
  );

  const pendingMediaBroadcastRef = useRef(false);

  const applyRemotePeerMediaState = useCallback((peerSocketId, message) => {
    const pc = peerConnections.current[peerSocketId];
    if (pc) {
      pc.getReceivers().forEach((receiver) => {
        const track = receiver.track;
        if (!track || track.readyState !== 'live') return;
        if (track.kind === 'audio') {
          track.enabled = message.mic !== false;
        } else if (track.kind === 'video') {
          track.enabled = message.video !== false;
        }
      });
    }

    setPeerMediaState((prev) => ({
      ...prev,
      [peerSocketId]: {
        isMicOn: message.mic !== false,
        isVideoOn: message.video !== false,
      },
    }));
  }, []);

  const broadcastMediaState = useCallback(() => {
    const { mic, video } = readLocalMediaFlags();
    isMicOnRef.current = mic;
    isVideoOnRef.current = video;

    const payload = JSON.stringify({
      type: 'media-state',
      mic,
      video,
    });

    const channels = Object.entries(dataChannelsRef.current);
    let sent = 0;
    channels.forEach(([, channel]) => {
      if (channel.readyState === 'open') {
        channel.send(payload);
        sent += 1;
      }
    });

    if (sent === 0) {
      pendingMediaStatePayloadRef.current = payload;
      pendingMediaBroadcastRef.current = true;
    } else {
      pendingMediaStatePayloadRef.current = null;
      pendingMediaBroadcastRef.current = false;
    }

    mediaLog.debug('media', 'Broadcast media state', {
      mic,
      video,
      channelsOpen: sent,
      channelsTotal: channels.length,
      queued: pendingMediaBroadcastRef.current,
    });
  }, [readLocalMediaFlags]);

  const setupMediaDataChannel = useCallback(
    (channel, peerSocketId) => {
      if (!channel) return;

      const existing = dataChannelsRef.current[peerSocketId];
      if (existing === channel) {
        if (existing.readyState === 'open') return;
      } else if (existing && existing !== channel) {
        if (existing.readyState === 'open' && channel.readyState !== 'open') {
          return;
        }
        if (existing.readyState !== 'closed') {
          try {
            existing.close();
          } catch {
            /* ignore */
          }
        }
      }

      dataChannelsRef.current[peerSocketId] = channel;

      channel.onopen = () => {
        const pendingPayload = pendingMediaStatePayloadRef.current;
        if (pendingPayload) {
          try {
            channel.send(pendingPayload);
            pendingMediaStatePayloadRef.current = null;
            pendingMediaBroadcastRef.current = false;
            mediaLog.debug('media', 'Flushed queued media state on channel open', peerSocketId);
          } catch (err) {
            mediaLog.warn('media', 'Failed to flush queued media state', err?.message);
          }
        }
        broadcastMediaState();
        if (hasLiveLocalStream()) {
          repairOutboundSendersIfNeeded().catch(() => { });
        }
        if (import.meta.env.DEV) {
          console.log('[RTC:media] Data channel open', peerSocketId);
        }
        mediaLog.debug('media', 'Media data channel open', peerSocketId);
      };

      channel.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type !== 'media-state') return;
          applyRemotePeerMediaState(peerSocketId, message);
          if (import.meta.env.DEV) {
            console.log('[RTC:media] Remote state', peerSocketId, message);
          }
          mediaLog.debug('media', 'Remote media state received', peerSocketId);
        } catch {
          /* ignore malformed payloads */
        }
      };

      channel.onclose = () => {
        if (dataChannelsRef.current[peerSocketId] === channel) {
          delete dataChannelsRef.current[peerSocketId];
        }
        const pc = peerConnections.current[peerSocketId];
        const localSocketId = socketRef.current?.id;
        if (!pc || pc.signalingState === 'closed' || !localSocketId) return;

        if (shouldInitiateOffer(localSocketId, peerSocketId)) {
          mediaLog.warn('media', '[DATA-CHANNEL] offerer channel closed — recreating', peerSocketId);
          queueMicrotask(() => ensureMediaDataChannelRef.current(pc, peerSocketId));
        } else {
          mediaLog.warn('media', '[DATA-CHANNEL] joiner channel closed — awaiting offerer recreation', peerSocketId);
        }
      };
    },
    [broadcastMediaState, repairOutboundSendersIfNeeded, hasLiveLocalStream, applyRemotePeerMediaState],
  );

  const removePeer = useCallback((socketId) => {
    peersInitiatedRef.current.delete(socketId);
    negotiatedPeersRef.current.delete(socketId);
    makingOfferRef.current.delete(socketId);
    delete peerSenderSlotsRef.current[socketId];
    if (import.meta.env.DEV) {
      mediaLog.debug('peer', 'Peer removed', socketId);
    }
    if (peerConnections.current[socketId]) {
      peerConnections.current[socketId].close();
      delete peerConnections.current[socketId];
    }
    setRemoteStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setRemoteScreenStreams((prev) => {
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setPeerNames((prev) => {
      if (!prev[socketId]) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    setPeerMediaState((prev) => {
      if (!prev[socketId]) return prev;
      const next = { ...prev };
      delete next[socketId];
      return next;
    });
    trackListenerCleanupRef.current[socketId]?.forEach((cleanup) => cleanup());
    delete trackListenerCleanupRef.current[socketId];
    delete remoteListenerTrackIdsRef.current[socketId];
    delete appliedRemoteTrackIdsRef.current[socketId];
    if (dataChannelsRef.current[socketId]) {
      try {
        dataChannelsRef.current[socketId].close();
      } catch {
        /* already closed */
      }
      delete dataChannelsRef.current[socketId];
    }
  }, []);

  const stopScreenShareRef = useRef(null);

  const routeRemoteVideoTrack = useCallback((targetSocketId, track) => {
    const isPresenterPeer = presenterRef.current?.socketId === targetSocketId;

    if (isPresenterPeer) {
      setRemoteScreenStreams((prev) => {
        // Always upsert — renegotiation can deliver a new track object with the same kind.
        const existing = prev[targetSocketId];
        const alreadyHasSameTrack = existing?.getTracks().some((t) => t === track);
        if (alreadyHasSameTrack) return prev;
        return {
          ...prev,
          [targetSocketId]: upsertTrackOnStream(existing, track),
        };
      });
      setRemoteStreams((prev) => {
        const existing = prev[targetSocketId];
        if (!existing) return prev;
        const audioOnly = new MediaStream(existing.getAudioTracks());
        if (audioOnly.getTracks().length === 0) {
          const next = { ...prev };
          delete next[targetSocketId];
          return next;
        }
        return { ...prev, [targetSocketId]: audioOnly };
      });
    } else {
      setRemoteStreams((prev) => {
        const existing = prev[targetSocketId];
        // Compare by object identity (not id) — renegotiated track is a new object.
        const alreadyHasSameTrack = existing?.getTracks().some((t) => t === track);
        if (alreadyHasSameTrack) return prev;
        return {
          ...prev,
          [targetSocketId]: upsertTrackOnStream(existing, track),
        };
      });
      setRemoteScreenStreams((prev) => {
        if (!prev[targetSocketId]) return prev;
        const next = { ...prev };
        delete next[targetSocketId];
        return next;
      });
    }
  }, []);

  const applyRemoteTrack = useCallback(
    (targetSocketId, track) => {
      if (!track) return;

      if (!appliedRemoteTrackIdsRef.current[targetSocketId]) {
        appliedRemoteTrackIdsRef.current[targetSocketId] = new Set();
      }

      // For audio: deduplicate strictly (same track ID = same sender).
      // For video: always re-route even if seen before — the track may have been
      // renegotiated (e.g. joiner enabled camera) and the stream reference needs updating.
      if (track.kind === 'audio' && appliedRemoteTrackIdsRef.current[targetSocketId].has(track.id)) {
        updatePeerMediaStateFromTrack(targetSocketId, track);
        return;
      }

      attachRemoteTrackListeners(targetSocketId, track);

      if (track.kind === 'audio') {
        setRemoteStreams((prev) => {
          const existing = prev[targetSocketId];
          if (
            existing?.getAudioTracks()[0] === track ||
            existing?.getTracks().some((t) => t.id === track.id)
          ) {
            return prev;
          }
          return {
            ...prev,
            [targetSocketId]: upsertTrackOnStream(existing, track),
          };
        });
        appliedRemoteTrackIdsRef.current[targetSocketId].add(track.id);
        mediaLog.info('track', '[AUDIO-FALLBACK] remote audio track received', {
          peer: targetSocketId,
          trackId: track.id,
          enabled: track.enabled,
          readyState: track.readyState,
        });
        return;
      }

      if (track.kind === 'video') {
        // Log track state before routing — critical for black-screen diagnosis.
        mediaLog.info('track', '[REMOTE-VIDEO] track state', {
          peer: targetSocketId,
          trackId: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
          muted: track.muted,
          presenter: presenterRef.current?.socketId === targetSocketId,
          alreadySeen: appliedRemoteTrackIdsRef.current[targetSocketId].has(track.id),
        });

        // Ensure track is enabled (remote tracks default to enabled=true but guard anyway).
        if (!track.enabled) {
          track.enabled = true;
        }

        routeRemoteVideoTrack(targetSocketId, track);
        appliedRemoteTrackIdsRef.current[targetSocketId].add(track.id);

        mediaLog.info('track', '[REMOTE-VIDEO] track attached', {
          peer: targetSocketId,
          trackId: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
        });
      }
    },
    [routeRemoteVideoTrack, attachRemoteTrackListeners, updatePeerMediaStateFromTrack],
  );

  const syncReceivers = useCallback(
    (pc, targetSocketId) => {
      pc.getReceivers().forEach((receiver) => {
        const track = receiver.track;
        if (!track) return;
        // Always re-apply on sync — stream may have been rebuilt after renegotiation.
        // Remove from applied set so applyRemoteTrack routes it fresh.
        if (track.kind === 'video') {
          appliedRemoteTrackIdsRef.current[targetSocketId]?.delete(track.id);
        }
        applyRemoteTrack(targetSocketId, track);
      });
    },
    [applyRemoteTrack],
  );


  const createPeerConnection = useCallback(
    (targetSocketId, stream) => {
      const existing = peerConnections.current[targetSocketId];
      if (existing) {
        if (import.meta.env.DEV) {
          mediaLog.debug('peer', 'Reusing existing peer connection', targetSocketId);
        }
        ensureLocalTracksOnPc(existing, stream);
        return existing;
      }

      const pc = new RTCPeerConnection(ICE_SERVERS);
      peerConnections.current[targetSocketId] = pc;
      if (import.meta.env.DEV) {
        const peerCount = Object.keys(peerConnections.current).length;
        mediaLog.debug('peer', 'Peer connection created', { targetSocketId, peerCount });
        if (peerCount > 1) {
          mediaLog.debug('peer', 'Active peer map', Object.keys(peerConnections.current));
        }
      }

      if (stream) {
        ensureLocalTracksOnPc(pc, stream);
      }

      pc.onicecandidate = (event) => {
        const activeSocket = socketRef.current;
        if (event.candidate && activeSocket) {
          activeSocket.emit('ice-candidate', {
            roomId,
            targetSocketId,
            candidate: event.candidate,
          });
        }
      };

      pc.ontrack = (event) => {
        const { track, streams } = event;
        if (!track) return;
        mediaLog.info('track', '[REMOTE-VIDEO] ontrack fired', {
          peer: targetSocketId,
          kind: track.kind,
          trackId: track.id,
          readyState: track.readyState,
          enabled: track.enabled,
          streamCount: streams?.length,
        });
        applyRemoteTrack(targetSocketId, track);
        track.onended = () => {
          mediaLog.debug('track', `Remote ${track.kind} ended`, {
            peer: targetSocketId,
            trackId: track.id,
          });
          appliedRemoteTrackIdsRef.current[targetSocketId]?.delete(track.id);
          remoteListenerTrackIdsRef.current[targetSocketId]?.delete(track.id);
        };
      };

      pc.onnegotiationneeded = async () => {
        // Allow BOTH peers to renegotiate — not just the initial offerer.
        // This is critical for joiner camera reacquire: when joiner calls addTrack(videoTrack),
        // onnegotiationneeded fires and the joiner must send an offer to push video RTP.
        // The existing makingOfferRef + offerCollision handling in handleOffer prevents loops.
        mediaLog.info('signaling', '[VIDEO-NEGOTIATION] negotiationneeded fired', {
          peer: targetSocketId,
          signalingState: pc.signalingState,
        });

        // CRITICAL FIX: Use queueRenegotiationWhenStable to ensure we don't drop offers
        // if this fires during an active negotiation cycle.
        queueRenegotiationWhenStable(pc, targetSocketId, async (pcArg, peerIdArg, labelArg) => {
          const stream = localStreamRef.current;
          if (stream) {
            try {
              // Re-run prepare inside the task so direction is sendrecv in the offer.
              await prepareLocalTracksForNegotiation(pcArg, stream, peerIdArg);
            } catch (prepErr) {
              mediaLog.warn('signaling', '[VIDEO-NEGOTIATION] prepareLocalTracks failed', prepErr?.message);
            }
          }
          const sent = await sendOffer(pcArg, peerIdArg, labelArg);
          if (sent) {
            mediaLog.info('signaling', '[VIDEO-NEGOTIATION] completed — offer sent', peerIdArg);
          }
        }, 'negotiationneeded');
      };
      
      pc.oniceconnectionstatechange = () => {
        mediaLog.info('media', '[DEBUG-ICE] ice state', {
          peerId: targetSocketId,
          iceState: pc.iceConnectionState,
        });
      };

      pc.onconnectionstatechange = () => {
        mediaLog.info('media', '[DEBUG-CONN] connection state changed', {
          peerId: targetSocketId,
          state: pc.connectionState,
          iceState: pc.iceConnectionState,
          signalingState: pc.signalingState,
        });
        mediaLog.debug('peer', `Connection ${pc.connectionState}`, {
          peer: targetSocketId,
          senders: pc.getSenders().map((s) => ({
            kind: s.track?.kind ?? 'none',
            enabled: s.track?.enabled,
          })),
        });
        if (pc.connectionState === 'connected') {
          console.log('[DEBUG-MEDIA] connection reached connected', { peerId: targetSocketId });
          ensureMediaDataChannelRef.current(pc, targetSocketId);
        }
        
        if (pc.connectionState === 'connected' && hasLiveLocalStream()) {
          const localSocketId = socketRef.current?.id;
          const isJoinerPeer = localSocketId && !shouldInitiateOffer(localSocketId, targetSocketId);

          if (isJoinerPeer) {
            queueMicrotask(() => {
              syncAnswererOutboundRef.current?.();
              broadcastMediaState();
            });
          } else {
            repairOutboundSendersIfNeeded()
              .then(() => broadcastMediaState())
              .catch(() => broadcastMediaState());
          }
          if (pendingMediaBroadcastRef.current) {
            queueMicrotask(() => broadcastMediaState());
          }

          // Re-sync remote tracks — catches any ontrack events that fired before React
          // state was ready, or tracks that arrived during ICE negotiation.
          queueMicrotask(() => syncReceivers(pc, targetSocketId));

          if (import.meta.env.DEV) {
            // Log transceiver directions so we can verify sendrecv is set correctly.
            pc.getTransceivers().forEach((tc) => {
              mediaLog.info('peer', '[VIDEO-SEND] transceiver at connected', {
                peer: targetSocketId,
                senderKind: tc.sender?.track?.kind ?? 'none',
                receiverKind: tc.receiver?.track?.kind ?? 'none',
                direction: tc.direction,
                currentDirection: tc.currentDirection,
                senderTrackEnabled: tc.sender?.track?.enabled,
                senderTrackReadyState: tc.sender?.track?.readyState,
              });
            });

            // VIDEO-STATS: log RTP stats at 3s and 8s after connection.
            const logStats = async (label) => {
              try {
                const stats = await pc.getStats();
                stats.forEach((report) => {
                  if (report.type === 'outbound-rtp' && report.kind === 'video') {
                    mediaLog.info('stats', `[VIDEO-STATS] ${label} outbound`, {
                      peer: targetSocketId,
                      framesSent: report.framesSent,
                      packetsSent: report.packetsSent,
                      bytesSent: report.bytesSent,
                      encoderImplementation: report.encoderImplementation,
                    });
                  }
                  if (report.type === 'inbound-rtp' && report.kind === 'video') {
                    mediaLog.info('stats', `[VIDEO-STATS] ${label} inbound`, {
                      peer: targetSocketId,
                      framesDecoded: report.framesDecoded,
                      packetsReceived: report.packetsReceived,
                      bytesReceived: report.bytesReceived,
                    });
                  }
                });
              } catch { /* ignore */ }
            };
            setTimeout(() => logStats('3s'), 3000);
            setTimeout(() => logStats('8s'), 8000);
          }
        }
        if (['failed', 'closed'].includes(pc.connectionState)) {
          removePeer(targetSocketId);
        }
      };


      pc.ondatachannel = (event) => {
        if (event.channel?.label === MEDIA_DC_LABEL) {
          setupMediaDataChannel(event.channel, targetSocketId);
        }
      };

      return pc;
    },
    [roomId, removePeer, applyRemoteTrack, setupMediaDataChannel, repairOutboundSendersIfNeeded, broadcastMediaState, hasLiveLocalStream, syncReceivers, prepareLocalTracksForNegotiation, sendOffer],
  );

  const ensureMediaDataChannel = useCallback(
    (pc, peerSocketId) => {
      const existing = dataChannelsRef.current[peerSocketId];
      if (existing?.readyState === 'open' || existing?.readyState === 'connecting') {
        return;
      }

      const localSocketId = socketRef.current?.id;
      if (!localSocketId || !shouldInitiateOffer(localSocketId, peerSocketId)) {
        return;
      }

      if (existing) {
        try {
          existing.close();
        } catch {
          /* ignore */
        }
        delete dataChannelsRef.current[peerSocketId];
      }
      try {
        const channel = pc.createDataChannel(MEDIA_DC_LABEL, { ordered: true });
        setupMediaDataChannel(channel, peerSocketId);
      } catch (err) {
        mediaLog.warn('media', 'Could not create media data channel', err?.message);
      }
    },
    [setupMediaDataChannel],
  );

  ensureMediaDataChannelRef.current = ensureMediaDataChannel;

  const replaceOutgoingVideo = useCallback(
    async (newTrack) => {
      const stream = localStreamRef.current;
      const screenStream = screenStreamRef.current;

      const tasks = Object.entries(peerConnections.current).map(async ([targetSocketId, pc]) => {
        let sender = getVideoSender(pc);
        if (!sender && newTrack && stream) {
          const outbound = isSharingScreenRef.current && screenStream ? screenStream : stream;
          sender = pc.addTrack(newTrack, outbound);
          mediaLog.debug('screen', 'Video sender added', targetSocketId);
        }
        if (!sender) {
          mediaLog.warn('screen', 'No video sender', targetSocketId);
          return;
        }
        if (import.meta.env.DEV) {
          mediaLog.debug('screen', 'replaceTrack(video)', {
            peer: targetSocketId,
            hasTrack: !!newTrack,
            enabled: newTrack?.enabled,
          });
        }
        await sender.replaceTrack(newTrack);
        if (newTrack) {
          newTrack.enabled = isSharingScreenRef.current ? true : isVideoOnRef.current;
        }
        mediaLog.debug('screen', 'Video track replaced', {
          peer: targetSocketId,
          sharing: !!newTrack,
          enabled: newTrack?.enabled,
          senderHasTrack: !!sender.track,
        });
      });
      await Promise.all(tasks);
      await renegotiateAll(newTrack ? 'screen-share-start' : 'screen-share-stop');
    },
    [renegotiateAll],
  );

  const startScreenShare = useCallback(async () => {
    const activeSocket = socketRef.current;
    if (!activeSocket) return false;
    try {
      const displayStream = await navigator.mediaDevices.getDisplayMedia({
        video: { cursor: 'always' },
        audio: false,
      });
      const screenTrack = displayStream.getVideoTracks()[0];
      if (!screenTrack) {
        displayStream.getTracks().forEach((t) => t.stop());
        return false;
      }

      screenTrackRef.current = screenTrack;
      setScreenStream(displayStream);
      screenStreamRef.current = displayStream;
      isSharingScreenRef.current = true;

      await replaceOutgoingVideo(screenTrack);
      broadcastMediaState();

      activeSocket.emit('start-screen-share', { roomId });

      screenTrack.onended = () => {
        stopScreenShareRef.current?.();
      };

      mediaLog.info('screen', 'Screen share started');
      return true;
    } catch (err) {
      mediaLog.error('screen', 'getDisplayMedia failed', err?.message || err);
      return false;
    }
  }, [roomId, replaceOutgoingVideo, broadcastMediaState]);

  const stopScreenShare = useCallback(async () => {
    isSharingScreenRef.current = false;

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
    screenStreamRef.current = null;
    screenTrackRef.current = null;
    setScreenStream(null);

    const cameraTrack = getOutgoingVideoTrack(
      false,
      null,
      localStreamRef.current,
    );
    if (cameraTrack) {
      cameraTrack.enabled = isVideoOnRef.current;
    }
    try {
      await replaceOutgoingVideo(cameraTrack);
      broadcastMediaState();
    } catch (err) {
      mediaLog.error('screen', 'Failed to restore camera track', err?.message);
    }

    const activeSocket = socketRef.current;
    if (activeSocket) {
      activeSocket.emit('stop-screen-share', { roomId });
    }

    mediaLog.info('screen', 'Screen share stopped');
  }, [roomId, replaceOutgoingVideo, broadcastMediaState]);

  stopScreenShareRef.current = stopScreenShare;

  /**
   * Reacquire camera when joiner is in audio-only fallback (or track ended).
   * Video-only getUserMedia; audio track is untouched.
   *
   * Guards:
   * - videoAcquirePromise: one in-flight acquire; concurrent callers share the same promise
   * - videoRetryFailed: blocks passive re-entry until the user clicks camera again
   */
  const tryEnableVideoTrack = useCallback(async (userInitiated = false) => {
    if (videoAcquirePromise) {
      mediaLog.info('media', '[JOINER-VIDEO] already in flight');
      return false;
    }
    if (!userInitiated && videoRetryFailed) {
      mediaLog.info('media', '[JOINER-VIDEO] previous attempt failed, waiting for user retry');
      return false;
    }
    if (videoRetryLastFailedAt && Date.now() - videoRetryLastFailedAt < 2000) {
      mediaLog.warn('media', '[JOINER-VIDEO] too soon after last failure — wait 2s');
      return 'cooldown';
    }

    const stream = localStreamRef.current;
    if (!stream) {
      mediaLog.warn('media', '[JOINER-VIDEO] tryEnableVideoTrack — no local stream');
      return false;
    }

    videoAcquirePromise = (async () => {
      removeStaleLocalVideoTracks(stream);

      const existingVideo = getLiveLocalVideoTrack(stream);
      if (existingVideo) {
        existingVideo.enabled = true;
        isVideoOnRef.current = true;
        setIsVideoOn(true);
        setLocalMediaRevision((n) => n + 1);
        applyLocalTrackEnabledFlags();
        broadcastMediaState();
        videoRetryFailed = false;
        videoCameraInUse = false;
        clearVideoCameraInUsePoll();
        localVideoTrackRef.current = existingVideo;
        localMediaSingleton.stream = stream;
        mediaLog.info('media', '[JOINER-VIDEO] video already live — re-enabled');
        return true;
      }

      mediaLog.info('media', '[JOINER-VIDEO] video acquisition started', { retryStarted: true });

      let videoTrack;
      try {
        const vs = await navigator.mediaDevices.getUserMedia({ video: true, audio: false });
        videoTrack = vs.getVideoTracks()[0];
        if (!videoTrack) {
          vs.getTracks().forEach((t) => t.stop());
          videoRetryFailed = true;
          videoRetryLastFailedAt = Date.now();
          mediaLog.warn('media', '[JOINER-VIDEO] video acquisition — no track in stream');
          return false;
        }

        removeStaleLocalVideoTracks(stream);
        videoTrack.enabled = true;
        stream.addTrack(videoTrack);
        vs.getTracks().forEach((t) => {
          if (t !== videoTrack) t.stop();
        });
        localMediaSingleton.stream = stream;
        isVideoOnRef.current = true;
        setIsVideoOn(true);
        setLocalMediaRevision((n) => n + 1);
        attachLocalTrackListeners(stream);
        applyLocalTrackEnabledFlags();

        if (videoTrack.readyState !== 'live') {
          stream.removeTrack(videoTrack);
          videoTrack.stop();
          videoRetryFailed = true;
          videoRetryLastFailedAt = Date.now();
          mediaLog.warn('media', '[JOINER-VIDEO] video track not live after acquire', {
            readyState: videoTrack.readyState,
          });
          return false;
        }

        videoRetryFailed = false;
        videoCameraInUse = false;
        clearVideoCameraInUsePoll();
        localVideoTrackRef.current = videoTrack;
        mediaLog.info('media', '[JOINER-VIDEO] video acquisition succeeded — track added to stream', {
          trackId: videoTrack.id,
          readyState: videoTrack.readyState,
        });

        for (const [peerId, pc] of Object.entries(peerConnections.current)) {
          const videoSender = resolveOutboundSender(pc, peerId, 'video');
          if (videoSender && videoSender.track !== videoTrack) {
            try {
              await videoSender.replaceTrack(videoTrack);
              rememberOutboundSender(peerId, 'video', videoSender);
              mediaLog.info('media', '[VIDEO] sender track replaced after reacquire', {
                peerId,
                trackId: videoTrack.id,
              });
            } catch (err) {
              mediaLog.warn('media', '[VIDEO] replaceTrack failed', {
                peerId,
                err: err.message,
              });
            }
          } else if (!videoSender) {
            const added = pc.addTrack(videoTrack, stream);
            rememberOutboundSender(peerId, 'video', added);
          }
        }

        broadcastMediaState();
        return true;
      } catch (err) {
        mediaLog.warn('media', '[JOINER-VIDEO] video acquisition failed', {
          retryFailed: true,
          name: err?.name,
          reason: err?.message || String(err),
        });
        return reportCameraAcquireError(err, toast);
      }
    })();

    try {
      const acquired = await videoAcquirePromise;
      if (acquired) {
        await syncOutboundAfterCameraOn();
      }
      return acquired;
    } finally {
      videoAcquirePromise = null;
    }
  }, [
    applyLocalTrackEnabledFlags,
    broadcastMediaState,
    attachLocalTrackListeners,
    resolveOutboundSender,
    rememberOutboundSender,
    syncOutboundAfterCameraOn,
    toast,
  ]);

  const tryEnableVideoTrackRef = useRef(tryEnableVideoTrack);
  tryEnableVideoTrackRef.current = tryEnableVideoTrack;

  useEffect(() => {
    videoCameraInUsePollAttempt = (userInitiated) => tryEnableVideoTrackRef.current?.(userInitiated);
    return () => {
      videoCameraInUsePollAttempt = null;
      videoCameraInUse = false;
      clearVideoCameraInUsePoll();
    };
  }, []);

  const syncOutboundAfterCameraOff = useCallback(async () => {
    const localSocketId = socketRef.current?.id;
    const stream = localStreamRef.current;
    if (!localSocketId || !stream) return;

    await Promise.all(
      Object.entries(peerConnections.current).map(async ([peerId, pc]) => {
        if (pc.signalingState === 'closed') return;
        if (!shouldInitiateOffer(localSocketId, peerId)) return;

        try {
          clearOutboundSenderCache(peerId);
          await prepareLocalTracksForNegotiation(pc, stream, peerId);
        } catch (err) {
          mediaLog.warn('signaling', '[CAMERA-OFF] offerer prepare failed', err?.message);
          return;
        }

        queueRenegotiationWhenStable(
          pc,
          peerId,
          async (pcArg, peerIdArg, labelArg) => {
            try {
              await prepareLocalTracksForNegotiation(pcArg, stream, peerIdArg);
            } catch (prepErr) {
              mediaLog.warn('signaling', '[CAMERA-OFF] prepare before offer failed', prepErr?.message);
            }
            return sendOffer(pcArg, peerIdArg, labelArg);
          },
          'camera-off',
        );
      }),
    );

    await syncAnswererOutboundAfterMediaToggle();

    Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
      if (shouldInitiateOffer(localSocketId, peerId)) {
        ensureMediaDataChannelRef.current(pc, peerId);
      }
    });
  }, [
    prepareLocalTracksForNegotiation,
    sendOffer,
    clearOutboundSenderCache,
    syncAnswererOutboundAfterMediaToggle,
  ]);

  const promotePresenterRemoteVideo = useCallback((sharerSocketId) => {
    setRemoteStreams((prev) => {
      const cam = prev[sharerSocketId];
      const videoTrack = cam?.getVideoTracks()[0];
      if (!videoTrack) return prev;

      const audioOnly = new MediaStream(cam.getAudioTracks());
      const nextCam = { ...prev };
      if (audioOnly.getTracks().length > 0) {
        nextCam[sharerSocketId] = audioOnly;
      } else {
        delete nextCam[sharerSocketId];
      }

      setRemoteScreenStreams((screenPrev) => ({
        ...screenPrev,
        [sharerSocketId]: upsertTrackOnStream(screenPrev[sharerSocketId], videoTrack),
      }));

      return nextCam;
    });
  }, []);

  const demotePresenterRemoteVideo = useCallback((sharerSocketId) => {
    setRemoteScreenStreams((prev) => {
      const screen = prev[sharerSocketId];
      const videoTrack = screen?.getVideoTracks()[0];
      if (!videoTrack) {
        const next = { ...prev };
        delete next[sharerSocketId];
        return next;
      }

      setRemoteStreams((camPrev) => ({
        ...camPrev,
        [sharerSocketId]: upsertTrackOnStream(camPrev[sharerSocketId], videoTrack),
      }));

      const next = { ...prev };
      delete next[sharerSocketId];
      return next;
    });
  }, []);

  useEffect(() => {
    if (!socket || !roomId) {
      signalingHandlersRef.current = {};
      return undefined;
    }

    const localSocketId = socket.id;

    const reroutePresenterVideoTracks = (sharerSocketId) => {
      const pc = peerConnections.current[sharerSocketId];
      if (!pc) return;
      pc.getReceivers().forEach((receiver) => {
        const track = receiver.track;
        if (track?.kind === 'video') {
          appliedRemoteTrackIdsRef.current[sharerSocketId]?.delete(track.id);
          applyRemoteTrack(sharerSocketId, track);
        }
      });
    };

    const handleScreenStatus = (status) => {
      if (status.active) {
        const nextPresenter = {
          socketId: status.sharerSocketId,
          userId: status.sharerUserId,
          userName: status.sharerName,
        };
        presenterRef.current = nextPresenter;
        setPresenter(nextPresenter);
        rememberPeerName(status.sharerSocketId, status.sharerName);
        if (status.sharerSocketId !== localSocketId) {
          queueMicrotask(() => {
            const pc = peerConnections.current[status.sharerSocketId];
            if (pc) {
              syncReceivers(pc, status.sharerSocketId);
            }
            reroutePresenterVideoTracks(status.sharerSocketId);
          });
        }
      } else {
        const prevPresenter = presenterRef.current;
        presenterRef.current = null;
        setPresenter(null);
        if (prevPresenter?.socketId && prevPresenter.socketId !== localSocketId) {
          demotePresenterRemoteVideo(prevPresenter.socketId);
        }
        setRemoteScreenStreams((prev) => {
          const next = { ...prev };
          if (prevPresenter?.socketId) delete next[prevPresenter.socketId];
          return next;
        });
      }
    };

    const handleOffer = async ({ fromSocketId, fromUserName, sdp }) => {
      mediaLog.info('media', '[DEBUG-ANSWER] 1 entered', { from: fromSocketId });
      
      mediaLog.info('media', '[DEBUG] offer received', {
        from: fromSocketId,
        sdpType: sdp?.type,
      });

      mediaLog.info('media', '[DEBUG-SIGNAL] offer received', {
        from: fromSocketId,
        sdpType: sdp?.type,
      });

      rememberPeerName(fromSocketId, fromUserName);
      if (import.meta.env.DEV) {
        mediaLog.debug('signaling', 'handleOffer', {
          from: fromSocketId,
          local: localSocketId,
          role: shouldInitiateOffer(localSocketId, fromSocketId) ? 'offerer' : 'answerer',
        });
      }

      try {
        const stream = await awaitLocalStreamForSignaling();
        mediaLog.info('media', '[DEBUG-ANSWER] 2 stream ready');

        if (!stream) {
          mediaLog.warn('signaling', 'handleOffer skipped — local media not ready', fromSocketId);
          return;
        }

        let pc = peerConnections.current[fromSocketId];
        const isRenegotiation = !!pc;

        if (!pc) {
          // Answerer must not attach local tracks until after setRemoteDescription(offer).
          pc = createPeerConnection(fromSocketId, null);
          negotiatedPeersRef.current.add(fromSocketId);
        }
        mediaLog.info('media', '[DEBUG-ANSWER] 3 pc created');

        const polite = isPolitePeer(localSocketId, fromSocketId);
        const offerCollision =
          pc.signalingState === 'have-local-offer' || makingOfferRef.current.has(fromSocketId);

        if (offerCollision) {
          if (!polite && !pc.currentRemoteDescription) {
            mediaLog.debug('signaling', 'Offer glare — ignoring (initial)', fromSocketId);
            return;
          }
          mediaLog.debug('signaling', 'Offer glare — rolling back', fromSocketId);
          makingOfferRef.current.delete(fromSocketId);
          await pc.setLocalDescription({ type: 'rollback' });
        }

        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        mediaLog.info('media', '[DEBUG-ANSWER] 4 remote desc set');

        if (pc.signalingState === 'have-remote-offer') {
          try {
            await prepareLocalTracksForNegotiation(pc, stream, fromSocketId);
          } catch (err) {
            mediaLog.warn('media', '[DEBUG-ANSWER] prepareLocalTracks failed non-fatally', {
              err: err?.message,
            });
          }
          mediaLog.info('media', '[DEBUG-ANSWER] 5 tracks prepared');

          const answer = await pc.createAnswer();
          mediaLog.info('media', '[DEBUG-ANSWER] 6 answer created', {
            sdpType: answer?.type,
          });

          await pc.setLocalDescription(answer);
          mediaLog.info('media', '[DEBUG-ANSWER] 7 local desc set');

          mediaLog.info('media', '[DEBUG-ANSWER] 8 emitting answer', {
            to: fromSocketId,
            sdpType: answer?.type,
          });

          mediaLog.info('media', '[DEBUG-SIGNAL] answer emitted', {
            to: fromSocketId,
            sdpType: answer?.type,
          });

          socket.emit('answer', { roomId, targetSocketId: fromSocketId, sdp: answer });
          mediaLog.info('media', '[DEBUG-ANSWER] 9 answer emitted');

          queueMicrotask(() => syncAnswererOutboundRef.current?.());

          ensureMediaDataChannel(pc, fromSocketId);
          broadcastMediaState();
          logSenderState(fromSocketId, pc, 'after-answer-created');
          // Schedule RTP diagnostics
          setTimeout(() => logOutboundRtpStats(pc, fromSocketId, 'post-answer-sent'), 2000);

          mediaLog.debug(
            'signaling',
            isRenegotiation ? 'Renegotiation answer sent' : 'Answer sent',
            fromSocketId,
          );
        }
      } catch (err) {
        mediaLog.error('media', '[DEBUG-ANSWER] handleOffer threw', {
          message: err?.message,
          stack: err?.stack,
        });
      }
    };

    const handleAnswer = async ({ fromSocketId, fromUserName, sdp }) => {
      mediaLog.info('media', '[DEBUG-SIGNAL] answer received', {
        from: fromSocketId,
        sdpType: sdp?.type,
      });

      rememberPeerName(fromSocketId, fromUserName);
      if (import.meta.env.DEV) {
        mediaLog.debug('signaling', 'handleAnswer', {
          from: fromSocketId,
          local: localSocketId,
          role: shouldInitiateOffer(localSocketId, fromSocketId) ? 'offerer' : 'answerer',
        });
      }
      const pc = peerConnections.current[fromSocketId];
      if (!pc) return;

      makingOfferRef.current.delete(fromSocketId);

      try {
        await pc.setRemoteDescription(new RTCSessionDescription(sdp));
        negotiatedPeersRef.current.add(fromSocketId);
        ensureMediaDataChannel(pc, fromSocketId);
        broadcastMediaState();
        queueMicrotask(() => broadcastMediaState());
        logSenderState(fromSocketId, pc, 'after-answer-received');
        mediaLog.debug('signaling', 'Remote description set from answer', fromSocketId);

        // CRITICAL FIX: After receiving answer, verify OUR outbound transceiver directions.
        // setRemoteDescription(answer) can lock currentDirection to recvonly if the
        // remote SDP didn't include our sendrecv preference. Detect and log this.
        let needsRepair = false;
        pc.getTransceivers().forEach((tc) => {
          const kind = tc.sender?.track?.kind || tc.receiver?.track?.kind;
          const isOurSender = !!tc.sender?.track && tc.sender.track.readyState === 'live';

          if (import.meta.env.DEV) {
            mediaLog.info('signaling', '[ANSWER-DIRECTION-CHECK]', {
              peer: fromSocketId,
              kind,
              direction: tc.direction,
              currentDirection: tc.currentDirection,
              isOurSender,
            });
          }

          // If we intend to send (direction is sendrecv/sendonly) but negotiation
          // resulted in a direction that doesn't allow sending, we need a repair.
          if (isOurSender && tc.direction.includes('send') &&
            tc.currentDirection && !tc.currentDirection.includes('send')) {
            mediaLog.warn('signaling', `[ANSWER-DIRECTION-MISMATCH] ${kind} negotiated to ${tc.currentDirection} but we want to send`, { peer: fromSocketId });
            needsRepair = true;
          }
        });

        if (needsRepair) {
          mediaLog.info('signaling', '[ANSWER-DIRECTION-REPAIR] Triggering repair cycle', { peer: fromSocketId });
          queueMicrotask(() => repairOutboundSendersIfNeeded());
        }

        // Schedule RTP diagnostics
        setTimeout(() => logOutboundRtpStats(pc, fromSocketId, 'post-answer-received'), 2000);

        // After renegotiation answer (e.g. joiner enabled camera), sync receivers
        // to re-route any remote video tracks into remoteStreams.
        // syncReceivers clears the video dedup guard so the track is re-applied.
        queueMicrotask(() => syncReceivers(pc, fromSocketId));

        if (import.meta.env.DEV) {
          setTimeout(async () => {
            try {
              const stats = await pc.getStats();
              stats.forEach((report) => {
                if (report.type === 'outbound-rtp') {
                  mediaLog.info('stats', '[RTP-VERIFY] outbound-rtp after answer', {
                    peer: fromSocketId,
                    kind: report.kind,
                    packetsSent: report.packetsSent,
                    bytesSent: report.bytesSent,
                    framesSent: report.framesSent,
                  });
                }
              });
            } catch { /* ignore */ }
          }, 3000);
        }
      } catch (err) {
        mediaLog.error('signaling', 'handleAnswer failed', err?.message);
      }
    };


    const handleIceCandidate = async ({ fromSocketId, candidate }) => {
      const pc = peerConnections.current[fromSocketId];
      if (!pc || !candidate) return;
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        mediaLog.warn('signaling', 'ICE candidate error', err?.message);
      }
    };

    const handleUserLeft = ({ socketId }) => {
      if (socketId) removePeer(socketId);
    };

    const handleSignalingError = (payload) => {
      mediaLog.warn('signaling', 'Server signaling error', payload?.message);
    };

    const handleScreenShareError = (payload) => {
      mediaLog.warn('screen', 'Screen share error', payload?.message);
    };

    signalingHandlersRef.current = {
      handleScreenStatus,
      handleOffer,
      handleAnswer,
      handleIceCandidate,
      handleUserLeft,
      handleSignalingError,
      handleScreenShareError,
    };

    return undefined;
  }, [
    socket,
    roomId,
    createPeerConnection,
    awaitLocalStreamForSignaling,
    removePeer,
    rememberPeerName,
    promotePresenterRemoteVideo,
    demotePresenterRemoteVideo,
    prepareLocalTracksForNegotiation,
    broadcastMediaState,
    ensureMediaDataChannel,
    syncReceivers,
  ]);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const onScreenStatus = (status) => signalingHandlersRef.current.handleScreenStatus?.(status);
    const onOffer = (data) => signalingHandlersRef.current.handleOffer?.(data);
    const onAnswer = (data) => signalingHandlersRef.current.handleAnswer?.(data);
    const onIceCandidate = (data) => signalingHandlersRef.current.handleIceCandidate?.(data);
    const onUserLeft = (data) => signalingHandlersRef.current.handleUserLeft?.(data);
    const onSignalingError = (data) => signalingHandlersRef.current.handleSignalingError?.(data);
    const onScreenShareError = (data) => signalingHandlersRef.current.handleScreenShareError?.(data);

    socket.on('screen-share-status', onScreenStatus);
    socket.on('offer', onOffer);
    socket.on('answer', onAnswer);
    socket.on('ice-candidate', onIceCandidate);
    socket.on('user-left', onUserLeft);
    socket.on('signaling-error', onSignalingError);
    socket.on('screen-share-error', onScreenShareError);

    if (import.meta.env.DEV) {
      mediaLog.debug('signaling', 'WebRTC socket listeners registered', { roomId });
    }

    return () => {
      socket.off('screen-share-status', onScreenStatus);
      socket.off('offer', onOffer);
      socket.off('answer', onAnswer);
      socket.off('ice-candidate', onIceCandidate);
      socket.off('user-left', onUserLeft);
      socket.off('signaling-error', onSignalingError);
      socket.off('screen-share-error', onScreenShareError);
      if (import.meta.env.DEV) {
        mediaLog.debug('signaling', 'WebRTC socket listeners removed', { roomId });
      }
    };
  }, [socket, roomId]);

  const connectToPeer = useCallback(
    async (targetSocketId, name) => {
      const activeSocket = socketRef.current;
      if (!activeSocket || !targetSocketId || targetSocketId === activeSocket.id) return;
      if (!shouldInitiateOffer(activeSocket.id, targetSocketId)) return;

      const existingPc = peerConnections.current[targetSocketId];
      if (existingPc && !['failed', 'closed'].includes(existingPc.connectionState)) {
        if (existingPc.signalingState === 'stable' && existingPc.connectionState === 'connected') {
          ensureMediaDataChannel(existingPc, targetSocketId);
          if (hasLiveLocalStream()) {
            await repairOutboundSendersIfNeeded();
          }
          broadcastMediaState();
          mediaLog.debug('signaling', 'Peer already connected — re-synced media', targetSocketId);
          return;
        }
        if (makingOfferRef.current.has(targetSocketId)) {
          mediaLog.debug('signaling', 'Skip connect — offer in flight', targetSocketId);
          return;
        }
      }

      if (peersInitiatedRef.current.has(targetSocketId)) {
        const inflightPc = peerConnections.current[targetSocketId];
        if (inflightPc && !['failed', 'closed'].includes(inflightPc.connectionState)) {
          if (import.meta.env.DEV) {
            mediaLog.debug('signaling', 'Skip duplicate connectToPeer', targetSocketId);
          }
          return;
        }
        peersInitiatedRef.current.delete(targetSocketId);
      }

      peersInitiatedRef.current.add(targetSocketId);

      const stream = await awaitLocalStreamForSignaling();
      if (!stream) {
        mediaLog.warn('signaling', 'connectToPeer skipped — local media not ready', targetSocketId);
        return;
      }

      rememberPeerName(targetSocketId, name);

      const pc = createPeerConnection(targetSocketId, stream);
      ensureMediaDataChannel(pc, targetSocketId);
      negotiatedPeersRef.current.add(targetSocketId);

      await prepareLocalTracksForNegotiation(pc, stream, targetSocketId);
      await sendOffer(pc, targetSocketId, 'initial-offer');
      broadcastMediaState();
      logSenderState(targetSocketId, pc, 'after-initial-offer');
    },
    [
      createPeerConnection,
      awaitLocalStreamForSignaling,
      rememberPeerName,
      ensureMediaDataChannel,
      sendOffer,
      prepareLocalTracksForNegotiation,
      repairOutboundSendersIfNeeded,
      hasLiveLocalStream,
      broadcastMediaState,
    ],
  );

  connectToPeerRef.current = connectToPeer;

  const startConferencing = useCallback(
    async (activeUsers) => {
      const activeSocket = socketRef.current;
      if (!activeSocket || !Array.isArray(activeUsers) || !roomId) return;

      const remoteSocketIds = activeUsers
        .map((p) => p?.socketId)
        .filter((id) => id && id !== activeSocket.id);
      const peerKey = [...remoteSocketIds].sort().join('|');

      // Bug 3 fix: also check peerKey so a stale bootstrap for a different peer set is not reused
      if (
        conferencingSession.bootstrapPromise &&
        conferencingSession.roomId === roomId &&
        conferencingSession.peerKey === peerKey
      ) {
        logMediaLifecycle('startConferencing await existing bootstrap', { roomId, peerKey });
        return conferencingSession.bootstrapPromise;
      }

      // Bug 4 fix: also verify that peer connections for the expected peers actually exist;
      // if they were torn down (e.g. Strict Mode remount), allow reconferencing.
      const hasLivePeerConnections = remoteSocketIds.some(
        (id) => {
          const pc = peerConnections.current[id];
          return pc && !['failed', 'closed'].includes(pc.connectionState);
        },
      );
      const peersExpected = remoteSocketIds.length > 0;

      if (
        conferencingSession.hasStarted &&
        conferencingSession.roomId === roomId &&
        conferencingSession.peerKey === peerKey &&
        (!peersExpected || hasLivePeerConnections)
      ) {
        logMediaLifecycle('startConferencing skipped — already started', { roomId, peerKey });
        return;
      }

      conferencingSession.roomId = roomId;
      conferencingSession.peerKey = peerKey;

      conferencingSession.bootstrapPromise = (async () => {
        try {
          // Bug 2 fix: use ref so startConferencing doesn't depend on initLocalStream identity
          const stream = await initLocalStreamRef.current();
          if (!stream) {
            mediaLog.warn('signaling', 'startConferencing aborted — no local media', { roomId });
            return;
          }

          Object.keys(peerConnections.current).forEach((socketId) => {
            if (!remoteSocketIds.includes(socketId)) {
              if (import.meta.env.DEV) {
                mediaLog.debug('peer', 'Pruning peer not in participant list', socketId);
              }
              removePeer(socketId);
            }
          });

          for (const peer of activeUsers) {
            if (!peer?.socketId || peer.socketId === activeSocket.id) continue;
            rememberPeerName(peer.socketId, peer.name);

            if (shouldInitiateOffer(activeSocket.id, peer.socketId)) {
              await connectToPeer(peer.socketId, peer.name);
            } else {
              mediaLog.debug('signaling', 'Awaiting offer from peer', peer.socketId);
            }
          }

          conferencingSession.hasStarted = true;
        } finally {
          conferencingSession.bootstrapPromise = null;
        }
      })();

      return conferencingSession.bootstrapPromise;
    },
    // Bug 2 fix: initLocalStream removed — accessed via initLocalStreamRef.current() inside
    [roomId, rememberPeerName, connectToPeer, removePeer],
  );

  const logToggleTrackState = useCallback((label, track, peerId, sender) => {
    if (!import.meta.env.DEV) return;
    console.log(`[RTC:media] ${label}`, {
      peer: peerId,
      trackId: track?.id,
      trackEnabled: track?.enabled,
      trackReadyState: track?.readyState,
      senderTrackId: sender?.track?.id,
      senderTrackSameRef: sender?.track === track,
    });
  }, []);

  const applyLocalMicState = useCallback(
    async (enabled) => {
      const stream = localStreamRef.current;
      const audioTrack = getLiveLocalAudioTrack(stream);
      if (!audioTrack) {
        mediaLog.warn('media', 'Mic toggle skipped — no live audio track');
        return;
      }

      audioTrack.enabled = enabled;

      if (enabled) {
        const liveAudioTrack = getLiveLocalAudioTrack(localStreamRef.current);
        if (liveAudioTrack) {
          for (const [peerId, pc] of Object.entries(peerConnections.current)) {
            const audioSender = resolveOutboundSender(pc, peerId, 'audio');
            if (audioSender && audioSender.track !== liveAudioTrack) {
              try {
                await audioSender.replaceTrack(liveAudioTrack);
                rememberOutboundSender(peerId, 'audio', audioSender);
                mediaLog.info('media', '[MIC] sender replaced on mic-on', {
                  peerId,
                  trackId: liveAudioTrack.id,
                });
              } catch (err) {
                mediaLog.warn('media', '[MIC] replaceTrack mic-on failed', {
                  peerId,
                  err: err.message,
                });
              }
            }
          }
        }
      }

      isMicOnRef.current = enabled;
      setIsMicOn(enabled);
      setLocalMediaRevision((n) => n + 1);
      broadcastMediaState();
      queueMicrotask(() => broadcastMediaState());

      if (import.meta.env.DEV) {
        Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
          const audioSender = resolveOutboundSender(pc, peerId, 'audio');
          logToggleTrackState('Mic applied', audioTrack, peerId, audioSender);
        });
      }

      queueMicrotask(() => syncAnswererOutboundAfterMediaToggle());

      mediaLog.debug('media', 'Mic state applied', {
        enabled,
        trackEnabled: audioTrack.enabled,
        trackReadyState: audioTrack.readyState,
        peers: Object.keys(peerConnections.current).length,
      });
    },
    [
      broadcastMediaState,
      resolveOutboundSender,
      rememberOutboundSender,
      logToggleTrackState,
      syncAnswererOutboundAfterMediaToggle,
    ],
  );

  const applyLocalCameraState = useCallback(
    async (enabled, preferredTrack = null) => {
      if (isSharingScreenRef.current) {
        mediaLog.debug('media', 'Camera toggle ignored while screen sharing');
        return;
      }

      const stream = localStreamRef.current;
      if (!stream) return;

      removeStaleLocalVideoTracks(stream);

      if (enabled) {
        const livePreferred =
          preferredTrack?.readyState === 'live' ? preferredTrack : null;
        const liveTrack = livePreferred ?? getLiveLocalVideoTrack(stream);
        if (!liveTrack || liveTrack.readyState !== 'live') {
          mediaLog.info('media', 'Camera on — no live track, acquiring fresh video');
          await tryEnableVideoTrack(true);
          return;
        }

        liveTrack.enabled = true;
        localVideoTrackRef.current = liveTrack;
        isVideoOnRef.current = true;
        setIsVideoOn(true);
        applyLocalTrackEnabledFlags();

        let senderRebound = false;
        const videoStream = stream;
        for (const [peerId, pc] of Object.entries(peerConnections.current)) {
          if (pc.signalingState === 'closed') continue;
          let videoSender = resolveOutboundSender(pc, peerId, 'video');
          if (!videoSender) {
            videoSender = pc.addTrack(liveTrack, videoStream);
            rememberOutboundSender(peerId, 'video', videoSender);
            senderRebound = true;
          } else if (videoSender.track !== liveTrack) {
            try {
              await videoSender.replaceTrack(liveTrack);
              rememberOutboundSender(peerId, 'video', videoSender);
              senderRebound = true;
              mediaLog.info('media', '[VIDEO] sender replaced on camera-on', {
                peerId,
                trackId: liveTrack.id,
              });
            } catch (err) {
              mediaLog.warn('media', '[VIDEO] replaceTrack camera-on failed', {
                peerId,
                err: err.message,
              });
            }
          }
        }

        setLocalMediaRevision((n) => n + 1);
        broadcastMediaState();
        queueMicrotask(() => broadcastMediaState());

        if (import.meta.env.DEV) {
          Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
            const videoSender = resolveOutboundSender(pc, peerId, 'video');
            logToggleTrackState('Camera applied', liveTrack, peerId, videoSender);
          });
        }

        if (senderRebound) {
          queueMicrotask(() => syncOutboundAfterCameraOn());
        } else {
          queueMicrotask(() => syncAnswererOutboundAfterMediaToggle());
        }

        mediaLog.debug('media', 'Camera state applied', {
          enabled: true,
          trackEnabled: liveTrack.enabled,
          trackReadyState: liveTrack.readyState,
          peers: Object.keys(peerConnections.current).length,
        });
        return;
      }

      const cameraTrack =
        preferredTrack?.readyState === 'live' ? preferredTrack : getLiveLocalVideoTrack(stream);

      if (!cameraTrack) {
        mediaLog.warn('media', 'Camera toggle skipped — no live video track');
        return;
      }

      const stoppedTrackId = cameraTrack.id;
      cameraTrack.stop();
      if (stream.getVideoTracks().includes(cameraTrack)) {
        stream.removeTrack(cameraTrack);
      }
      localVideoTrackRef.current = null;
      localMediaSingleton.stream = stream;

      await Promise.all(
        Object.entries(peerConnections.current).map(async ([peerId, pc]) => {
          if (pc.signalingState === 'closed') return;
          const sender =
            resolveOutboundSender(pc, peerId, 'video') ??
            pc.getSenders().find((s) => s.track?.id === stoppedTrackId);
          if (!sender) return;
          try {
            await sender.replaceTrack(null);
          } catch (err) {
            mediaLog.warn('media', 'replaceTrack(null) failed', err?.message);
          }
          clearOutboundSenderCache(peerId);
        }),
      );

      isVideoOnRef.current = false;
      setIsVideoOn(false);
      setLocalMediaRevision((n) => n + 1);
      broadcastMediaState();
      queueMicrotask(() => broadcastMediaState());

      if (import.meta.env.DEV) {
        Object.entries(peerConnections.current).forEach(([peerId, pc]) => {
          const videoSender = resolveOutboundSender(pc, peerId, 'video');
          logToggleTrackState('Camera off (stopped)', null, peerId, videoSender);
        });
      }

      queueMicrotask(() => syncOutboundAfterCameraOff());

      mediaLog.debug('media', 'Camera stopped and hardware released', {
        stoppedTrackId,
        peers: Object.keys(peerConnections.current).length,
      });
    },
    [
      broadcastMediaState,
      resolveOutboundSender,
      rememberOutboundSender,
      logToggleTrackState,
      syncOutboundAfterCameraOn,
      syncOutboundAfterCameraOff,
      syncAnswererOutboundAfterMediaToggle,
      clearOutboundSenderCache,
      tryEnableVideoTrack,
    ],
  );

  const toggleMic = useCallback(() => {
    const stream = localStreamRef.current;
    const track = getLiveLocalAudioTrack(stream);
    if (!track) {
      mediaLog.warn('media', 'toggleMic skipped — no live audio track');
      return;
    }

    applyLocalMicState(!track.enabled);
    mediaLog.debug('media', `Mic ${track.enabled ? 'unmuted' : 'muted'}`, {
      trackId: track.id,
      trackEnabled: track.enabled,
      trackReadyState: track.readyState,
    });
  }, [applyLocalMicState]);

  const toggleVideo = useCallback(async () => {
    if (videoAcquirePromise || answererOutboundSyncInProgress) {
      mediaLog.info('media', '[JOINER-VIDEO] toggleVideo ignored — acquisition or outbound sync in flight');
      return;
    }

    removeStaleLocalVideoTracks(localStreamRef.current);
    const track = getLiveLocalVideoTrack(localStreamRef.current);

    if (!track) {
      if (videoRetryFailed) {
        mediaLog.info('media', '[JOINER-VIDEO] Camera toggle — retry after prior failure');
      }
      mediaLog.info('media', '[JOINER-VIDEO] Camera toggle → no live track, attempting reacquire');
      const result = await tryEnableVideoTrack(true);
      if (result === 'cooldown') {
        toast('Camera unavailable, please try again in a moment', 'error');
      }
      const acquired = getLiveLocalVideoTrack(localStreamRef.current);
      mediaLog.debug('media', `Camera ${acquired ? 'on' : 'off'}`, {
        trackId: acquired?.id,
        trackEnabled: acquired?.enabled,
        trackReadyState: acquired?.readyState ?? 'none',
      });
      return;
    }

    const turningOn = !track.enabled;
    await applyLocalCameraState(turningOn, track);

    const liveAfter = getLiveLocalVideoTrack(localStreamRef.current);
    mediaLog.debug('media', `Camera ${liveAfter?.enabled ? 'on' : 'off'}`, {
      trackId: liveAfter?.id,
      trackEnabled: liveAfter?.enabled,
      trackReadyState: liveAfter?.readyState ?? 'ended',
    });
  }, [applyLocalCameraState, tryEnableVideoTrack, toast]);

  useEffect(() => {
    return () => {
      // Reset conferencingSession so Strict Mode remount (or actual unmount)
      // can restart conferencing after peer connections are destroyed here.
      resetConferencingSession();
      negotiatedPeersRef.current.clear();
      makingOfferRef.current.clear();
      peersInitiatedRef.current.clear();
      peerSenderSlotsRef.current = {};
      isSharingScreenRef.current = false;
      // Do not clear videoAcquirePromise here — Strict Mode remount must not abort in-flight gUM.
      videoRetryFailed = false;
      videoCameraInUse = false;
      pendingMediaStatePayloadRef.current = null;
      if (videoCameraInUseTimer) {
        clearTimeout(videoCameraInUseTimer);
        videoCameraInUseTimer = null;
      }
      if (screenStreamRef.current) {
        screenStreamRef.current.getTracks().forEach((t) => t.stop());
      }
      Object.values(peerConnections.current).forEach((pc) => pc.close());
      peerConnections.current = {};
      Object.values(dataChannelsRef.current).forEach((channel) => {
        try {
          channel.close();
        } catch {
          /* ignore */
        }
      });
      dataChannelsRef.current = {};
      Object.values(trackListenerCleanupRef.current).forEach((cleanups) => {
        cleanups.forEach((cleanup) => cleanup());
      });
      trackListenerCleanupRef.current = {};
      localTrackListenersCleanupRef.current?.();
      localTrackListenersCleanupRef.current = null;
    };
  }, []);

  return {
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
    tryEnableVideoTrack,
    startConferencing,
    startScreenShare,
    stopScreenShare,
  };
};
