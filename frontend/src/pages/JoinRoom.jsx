import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiPlus, FiLogIn, FiArrowRight, FiShield } from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';
import { normalizeRoomCode, isValidRoomCode } from '../utils/roomId';
import Button from '../components/Button';
import Input from '../components/Input';
import Sidebar from '../components/Sidebar';

const JoinRoom = () => {
  const [roomId, setRoomId] = useState('');
  const [roomName, setRoomName] = useState('');
  const [mode, setMode] = useState('join'); // 'join' or 'create'
  const [localError, setLocalError] = useState('');
  const { joinRoom, createRoom, loading, error } = useRoom();

  const handleJoin = (e) => {
    e.preventDefault();
    setLocalError('');
    const code = normalizeRoomCode(roomId);
    if (!isValidRoomCode(code)) {
      setLocalError('Enter a valid 8-character room code');
      return;
    }
    joinRoom(code);
  };

  const handleCreate = (e) => {
    e.preventDefault();
    if (roomName) createRoom({ name: roomName });
  };

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <Sidebar />
      
      <main className="flex-1 ml-64 p-8 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-10"
          >
            <h1 className="text-4xl font-bold text-white mb-4">Start a Meeting</h1>
            <p className="text-secondary text-lg">Create a new room or join an existing one using a code.</p>
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
            className="glass-panel p-8 rounded-3xl"
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
                <Button className="w-full h-12 text-lg rounded-xl" isLoading={loading}>
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
                <Button className="w-full h-12 text-lg rounded-xl" isLoading={loading}>
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
