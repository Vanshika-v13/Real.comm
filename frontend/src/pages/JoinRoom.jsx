import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FiPlus, FiLogIn, FiArrowRight, FiShield, FiMenu } from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomId';
import Button from '../components/Button';
import Input from '../components/Input';
import Sidebar from '../components/Sidebar';

const JoinRoom = () => {
  const navigate = useNavigate();
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [joinApprovalEnabled, setJoinApprovalEnabled] = useState(false);
  const [mode, setMode] = useState('join'); // 'join' or 'create'
  const [localError, setLocalError] = useState('');
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const { 
    joinRoom, 
    createRoom, 
    loading, 
    error, 
    isPendingApproval, 
    cancelJoinRequest 
  } = useRoom();
  const [waitingTime, setWaitingTime] = useState(0);

  React.useEffect(() => {
    let timer;
    if (isPendingApproval) {
      timer = setInterval(() => {
        setWaitingTime((prev) => prev + 1);
      }, 1000);
    } else {
      setWaitingTime(0);
    }
    return () => clearInterval(timer);
  }, [isPendingApproval]);

  const handleJoin = (e) => {
    e.preventDefault();
    setLocalError('');
    const code = normalizeRoomCode(roomId);
    if (!isValidRoomCode(code)) {
      setLocalError('Enter a valid 8-character room code');
      return;
    }
    navigate(`/room/${code}`);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (roomName) createRoom({ name: roomName, joinApprovalEnabled });
  };

  if (isPendingApproval) {
    return (
      <div className="flex min-h-screen bg-background text-foreground w-full overflow-hidden">
        <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
        <main className="flex-1 ml-0 md:ml-64 p-4 md:p-8 flex flex-col items-center justify-center relative min-h-screen">
          <div className="w-full max-w-md glass-panel p-8 rounded-3xl text-center space-y-6">
            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center text-primary mx-auto animate-pulse">
              <FiShield className="w-8 h-8" />
            </div>
            <div className="space-y-2">
              <h2 className="text-xl font-bold text-white">Waiting for host approval...</h2>
              <p className="text-secondary text-sm font-light">
                {waitingTime > 30 
                  ? "Approval is taking longer than expected. You can cancel and try again, or ask the host to check their dashboard."
                  : "The meeting host has been notified. You will enter the meeting automatically once approved."}
              </p>
            </div>
            <Button 
              variant="outline" 
              className="w-full h-11 rounded-xl text-white border-white/10 hover:bg-white/5"
              onClick={cancelJoinRequest}
            >
              Cancel & Retry
            </Button>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-background text-foreground w-full overflow-hidden">
      <Sidebar mobileOpen={sidebarOpen} onCloseMobile={() => setSidebarOpen(false)} />
      
      <main className="flex-1 ml-0 md:ml-64 p-4 sm:p-6 md:p-8 lg:p-10 flex flex-col items-center justify-center relative min-h-screen">
        <button 
          className="md:hidden absolute top-4 left-4 p-2 bg-white/5 rounded-xl text-white hover:bg-white/10 z-10"
          onClick={() => setSidebarOpen(true)}
        >
          <FiMenu size={24} />
        </button>

        <div className="w-full max-w-xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-3xl sm:text-4xl font-bold text-white mb-2 sm:mb-4">Start a Meeting</h1>
            <p className="text-sm sm:text-lg text-secondary">Create a new room or join an existing one using a code.</p>
          </motion.div>

          <div className="flex gap-4 mb-8 bg-white/5 p-1.5 rounded-2xl border border-white/10 max-w-sm mx-auto">
            <button 
              onClick={() => setMode('join')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'join' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-white'}`}
            >
              <FiLogIn /> Join Room
            </button>
            <button 
              onClick={() => setMode('create')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-medium transition-all ${mode === 'create' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'text-secondary hover:text-white'}`}
            >
              <FiPlus /> Create Room
            </button>
          </div>

          <motion.div
            key={mode}
            initial={{ opacity: 0, x: mode === 'join' ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="glass-panel p-6 sm:p-8 rounded-3xl"
          >
            {(error || localError) && (
              <div className="bg-accent/10 border border-accent/20 text-accent px-4 py-3 rounded-xl text-sm mb-6">
                {error || localError}
              </div>
            )}

            {mode === 'join' ? (
              <form onSubmit={handleJoin} className="space-y-6">
                <Input 
                  label="Room Code"
                  placeholder="e.g. ABCD-1234"
                  value={roomId}
                  onChange={(e) => setRoomId(normalizeRoomCode(e.target.value))}
                  required
                />
                <div className="flex items-center gap-3 text-sm text-secondary bg-white/5 p-4 rounded-xl border border-white/5">
                  <FiShield className="text-primary flex-shrink-0" />
                  <span>Ensure you have the correct code from the meeting host.</span>
                </div>
                <Button className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl" isLoading={loading}>
                  Join Meeting <FiArrowRight className="ml-2" />
                </Button>
              </form>
            ) : (
              <form onSubmit={handleCreate} className="space-y-6">
                <Input 
                  label="Room Name"
                  placeholder="e.g. Project Sync"
                  value={roomName}
                  onChange={(e) => setRoomName(e.target.value)}
                  required
                />

                <div className="flex items-center justify-between p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
                  <div className="flex flex-col gap-1 pr-4">
                    <span className="text-sm font-semibold text-white">Require Host Approval</span>
                    <span className="text-xs text-secondary font-light">Guests must wait for host approval before joining.</span>
                  </div>
                  <button 
                    type="button"
                    onClick={() => setJoinApprovalEnabled(!joinApprovalEnabled)}
                    className={`relative w-14 h-8 rounded-full transition-all duration-300 focus:outline-none shrink-0 ${
                      joinApprovalEnabled ? 'bg-primary shadow-lg shadow-primary/20' : 'bg-white/10'
                    }`}
                  >
                    <div className={`absolute top-1 w-6 h-6 rounded-full bg-white transition-all duration-300 shadow-sm ${
                      joinApprovalEnabled ? 'left-7' : 'left-1'
                    }`} />
                  </button>
                </div>

                <Button className="w-full h-12 sm:h-14 text-base sm:text-lg rounded-xl" isLoading={loading}>
                  Create & Join <FiArrowRight className="ml-2" />
                </Button>
              </form>
            )}
          </motion.div>
        </div>
      </main>
    </div>
  );
};

export default JoinRoom;
