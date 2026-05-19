import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiMic, FiMicOff, FiVideo, FiVideoOff, FiMonitor, FiLogOut, 
  FiMessageSquare, FiEdit3, FiUsers, FiFolder, FiCopy, FiLayout,
  FiUploadCloud, FiDownload, FiTrash2, FiX, FiCheckCircle, FiSend, FiSmile, FiPlay, FiPause
} from 'react-icons/fi';

// Audio wave bar animations for active speakers
const AudioBars = ({ level, active }) => {
  const heights = [0.35, 0.55, 0.75, 0.55, 0.35].map((h) => h + level * 0.65);
  return (
    <motion.div
      className="flex items-end gap-0.5 h-3 shrink-0"
      animate={{ opacity: active ? 1 : 0.35 }}
    >
      {heights.map((h, i) => (
        <motion.span
          key={i}
          className="w-0.5 rounded-full bg-emerald-400"
          animate={{ height: active ? `${Math.max(3, h * 12)}px` : '3px' }}
          transition={{ type: 'spring', stiffness: 350, damping: 18 }}
        />
      ))}
    </motion.div>
  );
};

const Demo = () => {
  // --- Guided Tour State System ---
  const [isTourActive, setIsTourActive] = useState(true);
  const [tourStep, setTourStep] = useState(0);
  const [cursorPos, setCursorPos] = useState({ x: 0, y: 0 });
  const [cursorLabel, setCursorLabel] = useState('Starting Interactive Tour...');
  const [activeHoverId, setActiveHoverId] = useState(null);
  const [isClicking, setIsClicking] = useState(false);
  const [activeTargetId, setActiveTargetId] = useState(null);

  // --- Real-time Local Room States ---
  const [isMicOn, setIsMicOn] = useState(true);
  const [isVideoOn, setIsVideoOn] = useState(true);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [isWhiteboardOpen, setIsWhiteboardOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isFilePanelOpen, setIsFilePanelOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  const [presenter, setPresenter] = useState(null);

  // Speakers activity levels simulation
  const [alexSpeaking, setAlexSpeaking] = useState(false);
  const [alexAudioLevel, setAlexAudioLevel] = useState(0);
  const [sarahSpeaking, setSarahSpeaking] = useState(false);
  const [sarahAudioLevel, setSarahAudioLevel] = useState(0);
  const [danielSpeaking, setDanielSpeaking] = useState(false);
  const [mySpeaking, setMySpeaking] = useState(false);
  const [myAudioLevel, setMyAudioLevel] = useState(0);

  // Chat/Messages states
  const [chatInput, setChatInput] = useState('');
  const [messages, setMessages] = useState([
    { id: 1, sender: 'Alex', text: 'Hey guys! Glad to join the sync today.', time: '10:02 AM' },
    { id: 2, sender: 'Daniel', text: 'Hey all! The latency is incredibly low today.', time: '10:03 AM' },
    { id: 3, sender: 'Sarah', text: 'Indeed, let’s review the collaborative specs.', time: '10:03 AM' }
  ]);

  // Shared Files states
  const [files, setFiles] = useState([
    { id: 1, name: 'meeting_agenda.pdf', size: '1.2 MB', uploader: 'Alex' },
    { id: 2, name: 'homepage_design_v2.png', size: '4.8 MB', uploader: 'Sarah' }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  // Toast notification state
  const [toastMessage, setToastMessage] = useState(null);
  const [toastType, setToastType] = useState('info'); // info, success, warning

  // Refs for drawing/autoscroll
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const chatEndRef = useRef(null);
  const demoRoomId = 'DEMO-ROOM-XYZ';

  // --- Toast Trigger helper ---
  const triggerToast = (msg, type = 'info') => {
    setToastMessage(msg);
    setToastType(type);
    setTimeout(() => {
      setToastMessage(null);
    }, 3000);
  };

  // Autoscroll chat
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isChatOpen]);

  // --- Speaker Activity & Rotation Loop ---
  useEffect(() => {
    const rotationInterval = setInterval(() => {
      const activeSeed = Math.floor(Math.random() * 4);
      setAlexSpeaking(activeSeed === 0);
      setAlexAudioLevel(activeSeed === 0 ? Math.random() * 0.75 + 0.15 : 0);
      setSarahSpeaking(activeSeed === 1);
      setSarahAudioLevel(activeSeed === 1 ? Math.random() * 0.75 + 0.15 : 0);
      setDanielSpeaking(activeSeed === 2);
      
      if (isMicOn) {
        setMySpeaking(activeSeed === 3);
        setMyAudioLevel(activeSeed === 3 ? Math.random() * 0.75 + 0.15 : 0);
      } else {
        setMySpeaking(false);
        setMyAudioLevel(0);
      }
    }, 2500);

    return () => clearInterval(rotationInterval);
  }, [isMicOn]);

  // --- Guided Walkthrough Steps Setup ---
  const tourSteps = [
    {
      name: 'welcome',
      label: 'Welcome to Real.Comm! Let’s tour the app 🚀',
      targetId: null,
      delay: 3500
    },
    {
      name: 'mic-mute',
      label: 'Step 1: Mute your Microphone feed',
      targetId: 'demo-mic-btn',
      delay: 3000
    },
    {
      name: 'mic-unmute',
      label: 'Enabling active sound feeds again',
      targetId: 'demo-mic-btn',
      delay: 2500
    },
    {
      name: 'cam-mute',
      label: 'Step 2: Turn off video camera feed',
      targetId: 'demo-cam-btn',
      delay: 3000
    },
    {
      name: 'cam-unmute',
      label: 'Restoring live camera feeds',
      targetId: 'demo-cam-btn',
      delay: 2500
    },
    {
      name: 'open-chat',
      label: 'Step 3: Open the collaborative Room Chat',
      targetId: 'demo-chat-btn',
      delay: 3000
    },
    {
      name: 'type-message',
      label: 'Focusing chat field & typing message...',
      targetId: 'demo-chat-input',
      delay: 5000,
      text: 'Hey team! Let’s review the whiteboard.'
    },
    {
      name: 'send-message',
      label: 'Sending message to active peer room',
      targetId: 'demo-send-btn',
      delay: 2500
    },
    {
      name: 'screen-share',
      label: 'Step 4: Enable seamless screen sharing',
      targetId: 'demo-share-btn',
      delay: 5000
    },
    {
      name: 'open-whiteboard',
      label: 'Step 5: Toggle interactive Whiteboard panel',
      targetId: 'demo-whiteboard-btn',
      delay: 2500
    },
    {
      name: 'whiteboard-draw',
      label: 'Drawing collaborative annotations...',
      targetId: 'demo-whiteboard-canvas',
      delay: 5500
    },
    {
      name: 'close-whiteboard',
      label: 'Closing the drawing board modal',
      targetId: 'demo-whiteboard-close',
      delay: 2500
    },
    {
      name: 'open-participants',
      label: 'Step 6: View active room user counts',
      targetId: 'demo-participants-btn',
      delay: 3500
    },
    {
      name: 'reset',
      label: 'Walkthrough complete! Restarting loop...',
      targetId: null,
      delay: 2500
    }
  ];

  // Recalculate target position dynamically
  const updateCursorToTarget = useCallback((targetId) => {
    if (!targetId) {
      // Center of screen
      setCursorPos({ x: window.innerWidth / 2 - 10, y: window.innerHeight / 2 - 50 });
      return;
    }
    const el = document.getElementById(targetId);
    if (el) {
      const rect = el.getBoundingClientRect();
      setCursorPos({
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2
      });
    }
  }, []);

  // Window resize coordinate tracking listener
  useEffect(() => {
    const handleResize = () => {
      if (isTourActive) {
        const currentStep = tourSteps[tourStep];
        if (currentStep) {
          updateCursorToTarget(currentStep.targetId);
        }
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tourStep, isTourActive, updateCursorToTarget]);

  // --- Progressive Whiteboard Draw segments ---
  const drawWalkthroughShapes = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = contextRef.current || canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const startX = rect.width / 3;
    const startY = rect.height / 2;

    ctx.strokeStyle = '#10b981'; // Green stroke
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(startX, startY);

    let progress = 0;
    const drawInterval = setInterval(() => {
      progress += 4;
      if (progress <= 50) {
        // Draw downward checkmark stroke
        const curX = startX + progress * 0.8;
        const curY = startY + progress * 0.6;
        ctx.lineTo(curX, curY);
        ctx.stroke();
        // Cursor tracks pen tip
        setCursorPos({ x: rect.left + curX, y: rect.top + curY });
      } else if (progress <= 100) {
        // Draw upward checkmark stroke
        const p2 = progress - 50;
        const curX = startX + 40 + p2 * 1.8;
        const curY = startY + 30 - p2 * 1.2;
        ctx.lineTo(curX, curY);
        ctx.stroke();
        setCursorPos({ x: rect.left + curX, y: rect.top + curY });
      } else {
        clearInterval(drawInterval);
        ctx.closePath();
        triggerToast('Sarah: Fantastic checkmark!', 'success');
      }
    }, 40);
  };

  // --- Guided Tour Scheduler Loop ---
  useEffect(() => {
    if (!isTourActive) return;

    const step = tourSteps[tourStep];
    if (!step) return;

    setActiveTargetId(step.targetId);
    setCursorLabel(step.label);

    // Initial movement
    updateCursorToTarget(step.targetId);

    // Timeline execution
    const hoverTimeout = setTimeout(() => {
      // 1. Activate element hover trigger
      if (step.targetId) {
        setActiveHoverId(step.targetId);
      }

      // Timing check before clicking
      const clickDelay = setTimeout(() => {
        // 2. Animate scaling scale down (Click action)
        setIsClicking(true);

        const clickRelease = setTimeout(() => {
          setIsClicking(false);
          setActiveHoverId(null);

          // 3. Trigger state mutations based on step
          switch (step.name) {
            case 'welcome':
              setIsMicOn(true);
              setIsVideoOn(true);
              setIsScreenSharing(false);
              setIsWhiteboardOpen(false);
              setIsChatOpen(false);
              setIsParticipantsOpen(false);
              setPresenter(null);
              break;

            case 'mic-mute':
              setIsMicOn(false);
              triggerToast('Microphone muted', 'warning');
              break;

            case 'mic-unmute':
              setIsMicOn(true);
              triggerToast('Microphone unmuted', 'success');
              break;

            case 'cam-mute':
              setIsVideoOn(false);
              triggerToast('Camera turned off', 'warning');
              break;

            case 'cam-unmute':
              setIsVideoOn(true);
              triggerToast('Camera turned on', 'success');
              break;

            case 'open-chat':
              setIsChatOpen(true);
              setIsFilePanelOpen(false);
              setIsParticipantsOpen(false);
              break;

            case 'type-message':
              let typed = '';
              const fullText = step.text;
              let idx = 0;
              const typeTimer = setInterval(() => {
                if (idx < fullText.length) {
                  typed += fullText[idx];
                  setChatInput(typed);
                  idx++;
                } else {
                  clearInterval(typeTimer);
                }
              }, 70);
              break;

            case 'send-message':
              if (chatInput.trim() || step.text) {
                setMessages(prev => [...prev, {
                  id: Date.now(),
                  sender: 'You',
                  text: chatInput || step.text,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                setChatInput('');
              }
              break;

            case 'screen-share':
              setIsScreenSharing(true);
              setPresenter({ name: 'You', isMe: true });
              triggerToast('You started sharing your screen', 'success');
              break;

            case 'open-whiteboard':
              setIsWhiteboardOpen(true);
              break;

            case 'whiteboard-draw':
              drawWalkthroughShapes();
              break;

            case 'close-whiteboard':
              setIsWhiteboardOpen(false);
              break;

            case 'open-participants':
              setIsParticipantsOpen(true);
              setIsChatOpen(false);
              break;

            case 'reset':
              setIsMicOn(true);
              setIsVideoOn(true);
              setIsScreenSharing(false);
              setIsWhiteboardOpen(false);
              setIsChatOpen(false);
              setIsParticipantsOpen(false);
              setPresenter(null);
              break;

            default:
              break;
          }

          // 4. Schedule next step
          const stepTimer = setTimeout(() => {
            setTourStep((prev) => (prev + 1) % tourSteps.length);
          }, step.delay - 1800);

        }, 250); // click speed release

      }, 600); // 600ms hover delay

    }, 1000); // Wait 1s cursor movement to target before hover

    return () => {
      clearTimeout(hoverTimeout);
    };
  }, [tourStep, isTourActive, updateCursorToTarget, chatInput]);


  // --- Whiteboard canvas initialization ---
  useEffect(() => {
    if (!isWhiteboardOpen) return;

    const timer = setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;

      const rect = canvas.getBoundingClientRect();
      canvas.width = rect.width * 2;
      canvas.height = rect.height * 2;
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;

      const ctx = canvas.getContext('2d');
      ctx.scale(2, 2);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = '#6366f1';
      ctx.lineWidth = 3;
      contextRef.current = ctx;

      // Draw standard nice base collaboration board lines
      ctx.beginPath();
      ctx.arc(rect.width / 2 - 50, rect.height / 2 - 10, 35, 0, Math.PI * 2);
      ctx.stroke();

      ctx.strokeStyle = '#f43f5e';
      ctx.beginPath();
      ctx.rect(rect.width / 2 + 20, rect.height / 2 - 45, 75, 65);
      ctx.stroke();

      ctx.fillStyle = '#94a3b8';
      ctx.font = '11px sans-serif';
      ctx.fillText('User Microservice', rect.width / 2 - 95, rect.height / 2 + 45);
      ctx.fillText('Media Router', rect.width / 2 + 22, rect.height / 2 + 35);
    }, 150);

    return () => clearTimeout(timer);
  }, [isWhiteboardOpen]);

  return (
    <div className="flex h-screen h-[100dvh] h-[100svh] w-screen bg-slate-950 text-foreground overflow-hidden font-sans relative select-none">
      
      {/* Animated Smooth Cursor Pointer */}
      {isTourActive && (
        <motion.div
          animate={{ x: cursorPos.x, y: cursorPos.y }}
          transition={{ type: 'spring', stiffness: 90, damping: 15, mass: 0.8 }}
          style={{ position: 'fixed', zIndex: 9999, pointerEvents: 'none' }}
          className="relative"
        >
          {/* Neon Pointer SVG */}
          <motion.svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            animate={{ scale: isClicking ? 0.85 : 1 }}
            className="drop-shadow-[0_0_12px_rgba(99,102,241,0.6)] filter"
          >
            <path
              d="M3 3L11.5 21L14.5 13.5L22 10.5L3 3Z"
              fill="#6366f1"
              stroke="#ffffff"
              strokeWidth="2.5"
              strokeLinejoin="round"
            />
          </motion.svg>

          {/* Radial ripple click ring animation */}
          {isClicking && (
            <motion.span
              initial={{ scale: 0.5, opacity: 1 }}
              animate={{ scale: 2.2, opacity: 0 }}
              transition={{ duration: 0.45, ease: 'easeOut' }}
              className="absolute -top-1 -left-1 w-6 h-6 rounded-full border border-indigo-400 pointer-events-none"
            />
          )}

          {/* Glassmorphic step explanation tooltip */}
          <AnimatePresence>
            {cursorLabel && (
              <motion.div
                initial={{ opacity: 0, y: 10, scale: 0.9 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 10 }}
                className="ml-6 mt-4 px-3.5 py-2 rounded-2xl bg-slate-900/90 border border-white/10 text-[10px] font-bold text-indigo-300 shadow-2xl backdrop-blur-xl whitespace-nowrap tracking-wide flex items-center gap-1.5"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
                {cursorLabel}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Main room app layout structure */}
      <div className="flex-1 flex flex-col relative min-w-0">
        
        {/* Header Block */}
        <header className="h-16 px-4 md:px-6 flex items-center justify-between bg-slate-950/50 backdrop-blur-md border-b border-white/5 z-20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center font-bold text-white shadow-lg shadow-indigo-500/20">
              R
            </div>
            <div>
              <h1 className="text-xs font-semibold text-white truncate max-w-[120px] sm:max-w-none">Room {demoRoomId}</h1>
              <button
                type="button"
                className="flex items-center gap-1 text-[9px] text-slate-400 uppercase tracking-widest font-medium hover:text-indigo-400 transition-colors"
              >
                <span>Code: {demoRoomId}</span>
                <FiCopy className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>

          {/* Widescreen presenting alert banner */}
          {presenter && (
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="bg-indigo-500/10 border border-indigo-500/20 px-3.5 py-1.5 rounded-full flex items-center gap-2"
            >
              <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-pulse" />
              <span className="text-[10px] font-bold tracking-wider uppercase text-indigo-300">
                {presenter.isMe ? 'You are sharing screen' : `${presenter.name} is sharing screen`}
              </span>
            </motion.div>
          )}

          {/* Interactive controls skip tour switch */}
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => {
                setIsTourActive(!isTourActive);
                triggerToast(isTourActive ? 'Switched to Manual Sandbox Mode' : 'Restarting Interactive Guided Tour', 'info');
              }}
              className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-white/5 bg-white/5 text-[10px] font-bold text-white hover:bg-white/10 hover:border-white/10 transition-all shadow-md active:scale-95"
            >
              {isTourActive ? (
                <>
                  <FiPause className="text-indigo-400" size={11} />
                  <span>MANUAL SANDBOX</span>
                </>
              ) : (
                <>
                  <FiPlay className="text-emerald-400 animate-pulse" size={11} />
                  <span>START AUTO TOUR</span>
                </>
              )}
            </button>
            <div className="w-px h-6 bg-white/5" />
            <Link
              to="/"
              className="p-2 text-slate-400 hover:text-rose-400 hover:bg-white/5 rounded-xl transition-all"
              title="Leave room"
            >
              <FiLogOut size={16} />
            </Link>
          </div>
        </header>

        {/* Dynamic Meeting Grid & presentation content panel */}
        <div className="flex-1 p-4 md:p-6 relative overflow-hidden flex flex-col gap-4 min-h-0 select-none max-w-[1600px] mx-auto w-full">
          <AnimatePresence mode="wait">
            
            {/* Presentation/Screen Sharing active layout mode */}
            {isScreenSharing ? (
              <motion.div
                key="presentation"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.98 }}
                className="flex-1 flex flex-col gap-4 min-h-0"
              >
                {/* Simulated Shared Screen preview */}
                <div className="flex-1 rounded-[2rem] bg-slate-900 border border-white/5 overflow-hidden shadow-2xl relative flex flex-col min-h-0 aspect-video md:aspect-auto">
                  <div className="absolute top-4 left-4 z-10 px-3 py-1.5 rounded-full bg-black/60 backdrop-blur-md border border-white/10 flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-rose-500 animate-pulse" />
                    <span className="text-[9px] font-bold uppercase tracking-wider text-white">
                      Your Shared Presentation Stage
                    </span>
                  </div>

                  {/* Real high fidelity mockup interface preview (no fake analytics!) */}
                  <div className="flex-1 bg-slate-950 flex flex-col items-center justify-center p-8 overflow-hidden select-none relative">
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(99,102,241,0.06)_0%,transparent_75%)]" />
                    <div className="flex flex-col items-center gap-3 text-center z-10">
                      <div className="w-16 h-16 rounded-3xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 mb-2 shadow-2xl shadow-indigo-500/10 animate-bounce">
                        <FiMonitor size={28} />
                      </div>
                      <h3 className="text-sm font-semibold text-white">Active Screen Sharing Feed</h3>
                      <p className="text-[10px] text-slate-400 max-w-xs">
                        Sharing a high-definition preview window of the Real.Comm Collaborative Canvas. Peers can sync and draw in real-time.
                      </p>
                    </div>
                  </div>
                </div>

                {/* Bottom row scroll list of participants tiles */}
                <div className="h-24 xs:h-28 sm:h-32 md:h-36 flex gap-3 overflow-x-auto pb-1 shrink-0 scrollbar-none">
                  
                  {/* You Bottom Tile */}
                  <div className="min-w-[120px] xs:min-w-[150px] sm:min-w-[200px] rounded-xl sm:rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden flex items-center justify-center aspect-video shrink-0">
                    {isVideoOn ? (
                      <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                        <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 border border-white/10 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold font-sans">Y</div>
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                        <FiVideoOff className="text-slate-600 w-3.5 h-3.5 sm:w-4 sm:h-4" />
                      </div>
                    )}
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10 px-1.5 sm:px-2 py-0.5 rounded bg-black/60 text-[8px] sm:text-[9px] font-semibold text-white flex items-center gap-1 sm:gap-1.5 border border-white/5">
                      {!isMicOn && <FiMicOff className="text-rose-500 w-2 h-2 sm:w-2.5 sm:h-2.5" />}
                      {isMicOn && <AudioBars level={myAudioLevel} active={mySpeaking} />}
                      <span>You</span>
                    </div>
                  </div>

                  {/* Alex Bottom Tile */}
                  <div className={`min-w-[120px] xs:min-w-[150px] sm:min-w-[200px] rounded-xl sm:rounded-2xl bg-slate-900 border relative overflow-hidden flex items-center justify-center aspect-video shrink-0 transition-all ${alexSpeaking ? 'border-indigo-500/50 shadow-md shadow-indigo-500/10' : 'border-white/5'}`}>
                    <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-indigo-500/10 border border-white/10 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">A</div>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10 px-1.5 sm:px-2 py-0.5 rounded bg-black/60 text-[8px] sm:text-[9px] font-semibold text-white flex items-center gap-1 sm:gap-1.5 border border-white/5">
                      <AudioBars level={alexAudioLevel} active={alexSpeaking} />
                      <span>Alex</span>
                    </div>
                  </div>

                  {/* Sarah Bottom Tile */}
                  <div className={`min-w-[120px] xs:min-w-[150px] sm:min-w-[200px] rounded-xl sm:rounded-2xl bg-slate-900 border relative overflow-hidden flex items-center justify-center aspect-video shrink-0 transition-all ${sarahSpeaking ? 'border-indigo-500/50 shadow-md shadow-indigo-500/10' : 'border-white/5'}`}>
                    <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-rose-500/10 border border-white/10 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">S</div>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10 px-1.5 sm:px-2 py-0.5 rounded bg-black/60 text-[8px] sm:text-[9px] font-semibold text-white flex items-center gap-1 sm:gap-1.5 border border-white/5">
                      <AudioBars level={sarahAudioLevel} active={sarahSpeaking} />
                      <span>Sarah</span>
                    </div>
                  </div>

                  {/* Daniel Bottom Tile */}
                  <div className="min-w-[120px] xs:min-w-[150px] sm:min-w-[200px] rounded-xl sm:rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden flex items-center justify-center aspect-video shrink-0">
                    <div className="absolute inset-0 bg-slate-950 flex items-center justify-center">
                      <div className="w-7 h-7 sm:w-10 sm:h-10 rounded-full bg-emerald-500/10 border border-white/10 flex items-center justify-center text-white text-[10px] sm:text-xs font-bold">D</div>
                    </div>
                    <div className="absolute bottom-1.5 left-1.5 sm:bottom-2 sm:left-2 z-10 px-1.5 sm:px-2 py-0.5 rounded bg-black/60 text-[8px] sm:text-[9px] font-semibold text-white flex items-center gap-1 border border-white/5">
                      <FiMicOff className="text-rose-500 w-2 h-2 sm:w-2.5 sm:h-2.5" />
                      <span>Daniel</span>
                    </div>
                  </div>

                </div>
              </motion.div>
            ) : (
              // Standard Grid Layout Mode (No screenshare active)
              <motion.div
                key="grid"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="w-full max-w-[920px] mx-auto my-auto grid grid-cols-2 gap-4 md:gap-5 auto-rows-fr min-h-0"
              >
                
                {/* You Tile */}
                <div className={`w-full aspect-video rounded-xl sm:rounded-2xl bg-slate-900/50 border overflow-hidden relative flex items-center justify-center shadow-lg transition-all duration-300 ${
                  mySpeaking ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-2 ring-indigo-500/30' : 'border-white/5 hover:border-white/10'
                }`}>
                  {isVideoOn ? (
                    <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                      <div className="absolute inset-0 bg-gradient-to-tr from-indigo-500/10 to-purple-500/5 animate-pulse-slow" />
                      <div className="w-16 h-16 rounded-full bg-indigo-500/15 border border-indigo-500/20 flex items-center justify-center text-white font-bold text-xl shadow-2xl relative">
                        Y
                        <div className="absolute -inset-1 rounded-full border border-indigo-500/30 animate-ping opacity-35" />
                      </div>
                    </div>
                  ) : (
                    <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                      <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 text-xl font-bold shadow-md">
                        Y
                      </div>
                    </div>
                  )}
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 z-10">
                    {!isMicOn && <FiMicOff className="text-rose-500 w-3 h-3" />}
                    {isMicOn && <AudioBars level={myAudioLevel} active={mySpeaking} />}
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-white">You</span>
                  </div>
                </div>

                {/* Alex Tile */}
                <div className={`w-full aspect-video rounded-xl sm:rounded-2xl bg-slate-900/50 border overflow-hidden relative flex items-center justify-center shadow-lg transition-all duration-300 ${
                  alexSpeaking ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-2 ring-indigo-500/30' : 'border-white/5 hover:border-white/10'
                }`}>
                  <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-slate-950" />
                    <div className={`w-16 h-16 rounded-full bg-indigo-500/10 border border-white/10 flex items-center justify-center text-white text-xl font-bold shadow-2xl transition-all duration-300 ${alexSpeaking ? 'border-indigo-500/30 bg-indigo-500/20' : ''}`}>
                      A
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 z-10">
                    <AudioBars level={alexAudioLevel} active={alexSpeaking} />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-white">Alex</span>
                  </div>
                </div>

                {/* Sarah Tile */}
                <div className={`w-full aspect-video rounded-xl sm:rounded-2xl bg-slate-900/50 border overflow-hidden relative flex items-center justify-center shadow-lg transition-all duration-300 ${
                  sarahSpeaking ? 'border-indigo-500 shadow-[0_0_20px_rgba(99,102,241,0.2)] ring-2 ring-indigo-500/30' : 'border-white/5 hover:border-white/10'
                }`}>
                  <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-slate-950" />
                    <div className={`w-16 h-16 rounded-full bg-rose-500/10 border border-white/10 flex items-center justify-center text-white text-xl font-bold shadow-2xl transition-all duration-300 ${sarahSpeaking ? 'border-rose-500/30 bg-rose-500/20' : ''}`}>
                      S
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 z-10">
                    <AudioBars level={sarahAudioLevel} active={sarahSpeaking} />
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-white">Sarah</span>
                  </div>
                </div>

                {/* Daniel Tile */}
                <div className="w-full aspect-video rounded-xl sm:rounded-2xl bg-slate-900/50 border border-white/5 hover:border-white/10 overflow-hidden relative flex items-center justify-center shadow-lg animate-fade-in">
                  <div className="w-full h-full bg-slate-950 flex items-center justify-center relative">
                    <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-slate-950" />
                    <div className="w-16 h-16 rounded-full bg-slate-900 border border-white/5 flex items-center justify-center text-slate-500 text-xl font-bold shadow-md">
                      D
                    </div>
                  </div>
                  <div className="absolute bottom-4 left-4 px-3 py-1.5 rounded-full bg-black/40 backdrop-blur-md border border-white/10 flex items-center gap-2 z-10">
                    <FiMicOff className="text-rose-500 w-3 h-3" />
                    <div className="w-1.5 h-1.5 rounded-full bg-slate-500" />
                    <span className="text-xs font-semibold text-white">Daniel</span>
                  </div>
                </div>

              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Dynamic Bottom Controls Dashboard */}
        <div className="h-20 sm:h-24 bg-slate-950/80 backdrop-blur-xl border-t border-white/5 flex items-center justify-center px-4 shrink-0 z-20">
          <motion.div
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="glass-panel px-3.5 sm:px-6 py-2 sm:py-3.5 rounded-2xl sm:rounded-3xl flex items-center gap-2 sm:gap-4 shadow-2xl shadow-black/80 border-white/10 relative max-w-full"
          >
            {/* Mic Button */}
            <button
              type="button"
              id="demo-mic-btn"
              onClick={() => {
                setIsMicOn(!isMicOn);
                triggerToast(isMicOn ? 'Microphone muted' : 'Microphone unmuted', isMicOn ? 'warning' : 'success');
              }}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-mic-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isMicOn ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
            >
              {isMicOn ? <FiMic className="w-4 h-4 sm:w-5 sm:h-5" /> : <FiMicOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            {/* Camera Button */}
            <button
              type="button"
              id="demo-cam-btn"
              onClick={() => {
                setIsVideoOn(!isVideoOn);
                triggerToast(isVideoOn ? 'Camera disabled' : 'Camera enabled', isVideoOn ? 'warning' : 'success');
              }}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-cam-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isVideoOn ? 'bg-white/5 text-white hover:bg-white/10' : 'bg-rose-500/20 text-rose-400 hover:bg-rose-500/30'}`}
            >
              {isVideoOn ? <FiVideo className="w-4 h-4 sm:w-5 sm:h-5" /> : <FiVideoOff className="w-4 h-4 sm:w-5 sm:h-5" />}
            </button>

            <div className="w-px h-6 sm:h-8 bg-white/10 mx-0.5 sm:mx-1 shrink-0" />

            {/* Screen Share Button */}
            <button
              type="button"
              id="demo-share-btn"
              onClick={() => {
                if (isScreenSharing) {
                  setIsScreenSharing(false);
                  setPresenter(null);
                  triggerToast('Stopped screen sharing', 'info');
                } else {
                  setIsScreenSharing(true);
                  setPresenter({ name: 'You', isMe: true });
                  triggerToast('Started screen sharing', 'success');
                }
              }}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-share-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isScreenSharing ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              <FiMonitor className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Whiteboard Button */}
            <button
              type="button"
              id="demo-whiteboard-btn"
              onClick={() => setIsWhiteboardOpen(!isWhiteboardOpen)}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-whiteboard-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isWhiteboardOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              <FiEdit3 className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Chat Panel Toggle */}
            <button
              type="button"
              id="demo-chat-btn"
              onClick={() => {
                setIsChatOpen(!isChatOpen);
                setIsParticipantsOpen(false);
              }}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-chat-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isChatOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              <FiMessageSquare className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

            {/* Participants list Toggle */}
            <button
              type="button"
              id="demo-participants-btn"
              onClick={() => {
                setIsParticipantsOpen(!isParticipantsOpen);
                setIsChatOpen(false);
              }}
              className={`w-9 h-9 sm:w-12 sm:h-12 rounded-xl sm:rounded-2xl flex items-center justify-center transition-all group relative border shrink-0 ${
                activeHoverId === 'demo-participants-btn' ? 'scale-105 border-indigo-500 bg-indigo-500/20' : 'border-transparent'
              } ${isParticipantsOpen ? 'bg-indigo-500 text-white shadow-lg shadow-indigo-500/25' : 'bg-white/5 text-white hover:bg-white/10'}`}
            >
              <FiUsers className="w-4 h-4 sm:w-5 sm:h-5" />
            </button>

          </motion.div>
        </div>
      </div>

      {/* Slide-out Sidebar Panels */}
      <AnimatePresence>
        
        {/* Collaborative Chat Sidebar */}
        {isChatOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute right-0 top-0 h-full w-full sm:w-80 bg-slate-950/95 border-l border-white/5 z-30 flex flex-col shadow-2xl backdrop-blur-xl shrink-0"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <FiMessageSquare className="text-indigo-400" /> Room Chat
              </h2>
              <button
                type="button"
                onClick={() => setIsChatOpen(false)}
                className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
              >
                <FiX size={14} />
              </button>
            </div>

            {/* Simulated Chat Feed */}
            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-4 min-h-0">
              {messages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`flex flex-col ${msg.sender === 'You' ? 'items-end' : 'items-start'}`}
                >
                  <span className="text-[10px] text-slate-400 mb-1 font-semibold">{msg.sender}</span>
                  <div className={`px-4 py-2.5 rounded-2xl text-xs max-w-[85%] border leading-relaxed shadow-sm ${
                    msg.sender === 'You'
                      ? 'bg-indigo-500 text-white border-indigo-400/20 rounded-tr-none'
                      : 'bg-white/5 text-slate-200 border-white/5 rounded-tl-none'
                  }`}>
                    {msg.text}
                  </div>
                  <span className="text-[8px] text-slate-500 mt-1">{msg.time}</span>
                </motion.div>
              ))}
              <div ref={chatEndRef} />
            </div>

            {/* Chat Send bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (!chatInput.trim()) return;
                setMessages(prev => [...prev, {
                  id: Date.now(),
                  sender: 'You',
                  text: chatInput,
                  time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                }]);
                setChatInput('');
              }}
              className="p-4 border-t border-white/5 bg-slate-950 shrink-0"
            >
              <div className="flex items-center gap-2 relative">
                <input
                  type="text"
                  id="demo-chat-input"
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  placeholder="Type message..."
                  className="w-full bg-white/5 border border-white/5 rounded-xl px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-indigo-500 focus:bg-white/10 transition-all pr-10"
                />
                <button
                  type="submit"
                  id="demo-send-btn"
                  className={`absolute right-1.5 p-2 rounded-lg text-indigo-400 hover:text-white transition-all ${
                    activeHoverId === 'demo-send-btn' ? 'scale-110 bg-indigo-500/20 text-white' : ''
                  }`}
                >
                  <FiSend size={14} />
                </button>
              </div>
            </form>
          </motion.div>
        )}

        {/* Active Participants Sidebar */}
        {isParticipantsOpen && (
          <motion.div
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 25, stiffness: 220 }}
            className="absolute right-0 top-0 h-full w-full sm:w-80 bg-slate-950/95 border-l border-white/5 z-30 flex flex-col shadow-2xl backdrop-blur-xl shrink-0"
          >
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
                <FiUsers className="text-indigo-400" /> Active Users
              </h2>
              <button
                type="button"
                onClick={() => setIsParticipantsOpen(false)}
                className="p-1 rounded bg-white/5 text-slate-400 hover:text-white"
              >
                <FiX size={14} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 custom-scrollbar space-y-3 min-h-0">
              
              {/* You Participant block */}
              <div className="flex items-center gap-3 p-3 rounded-2xl bg-white/5 border border-white/5">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-500/20 to-rose-500/20 border border-white/10 flex items-center justify-center text-white font-bold text-xs">Y</div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">You (Viewer)</p>
                  <p className="text-[9px] text-indigo-400 font-medium">Local Client</p>
                </div>
              </div>

              {/* Alex Participant Block */}
              <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-indigo-500/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">A</div>
                  {alexSpeaking ? (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950 animate-pulse" />
                  ) : (
                    <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Alex</p>
                  <p className="text-[9px] text-slate-400 truncate">{alexSpeaking ? 'Speaking...' : 'Active Now'}</p>
                </div>
              </div>

              {/* Sarah Participant Block */}
              <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-rose-500/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">S</div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-emerald-500 rounded-full border-2 border-slate-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Sarah</p>
                  <p className="text-[9px] text-indigo-400 font-medium truncate">Active Now</p>
                </div>
              </div>

              {/* Daniel Participant Block */}
              <div className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors">
                <div className="relative shrink-0">
                  <div className="w-9 h-9 rounded-full bg-emerald-500/10 border border-white/10 flex items-center justify-center text-white font-bold text-xs">D</div>
                  <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-slate-950" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white truncate">Daniel</p>
                  <p className="text-[9px] text-slate-500 truncate">Muted</p>
                </div>
              </div>

            </div>
          </motion.div>
        )}

      </AnimatePresence>

      {/* Fullscreen Whiteboard modal annotation canvas */}
      <AnimatePresence>
        {isWhiteboardOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            className="fixed inset-0 z-50 bg-[#020617] flex flex-col p-4 md:p-6 select-none"
          >
            <div className="h-16 px-4 md:px-6 flex items-center justify-between border border-white/5 rounded-3xl bg-slate-900/50 backdrop-blur-xl mb-4 shrink-0">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-500 rounded flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
                  <FiEdit3 size={15} />
                </div>
                <span className="text-xs font-bold text-white uppercase tracking-wider">Collaborative Whiteboard Stage</span>
              </div>
              <button
                type="button"
                id="demo-whiteboard-close"
                onClick={() => setIsWhiteboardOpen(false)}
                className={`p-2.5 rounded-xl bg-white/5 text-slate-400 hover:text-white hover:bg-white/10 transition-all border ${
                  activeHoverId === 'demo-whiteboard-close' ? 'scale-105 border-rose-500 bg-rose-500/20 text-rose-400' : 'border-transparent'
                }`}
              >
                <FiX size={15} />
              </button>
            </div>

            {/* Canvas wrapper */}
            <div className="flex-1 relative overflow-hidden rounded-[2.5rem] border border-white/5 bg-slate-950 flex items-center justify-center min-h-0">
              <canvas
                ref={canvasRef}
                id="demo-whiteboard-canvas"
                className="w-full h-full cursor-crosshair bg-slate-950/40 bg-[radial-gradient(#ffffff04_1px,transparent_1px)] [background-size:24px_24px]"
              />
              <div className="absolute bottom-6 right-6 px-4 py-2 rounded-full bg-indigo-500/10 border border-indigo-500/20 backdrop-blur-md text-[9px] text-indigo-400 font-bold uppercase tracking-widest pointer-events-none select-none flex items-center gap-2 shadow-2xl">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-indigo-400"></span>
                </span>
                Canvas Sync Active
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Floating dynamic bottom popup notifications Toast */}
      <AnimatePresence>
        {toastMessage && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-28 left-6 z-50 px-4 py-3 rounded-2xl border backdrop-blur-md shadow-2xl flex items-center gap-2.5 text-xs font-semibold ${
              toastType === 'success'
                ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'
                : toastType === 'warning'
                  ? 'bg-rose-500/10 border-rose-500/20 text-rose-400'
                  : 'bg-indigo-500/10 border-indigo-500/20 text-indigo-300'
            }`}
          >
            <FiCheckCircle size={15} className="shrink-0" />
            <span>{toastMessage}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
};

export default Demo;
