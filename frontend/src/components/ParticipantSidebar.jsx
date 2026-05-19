import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiCircle } from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';
import { dedupeParticipants } from '../utils/participants';

const ParticipantSidebar = () => {
  const { participants } = useRoom();
  const visibleParticipants = dedupeParticipants(participants);

  return (
    <div className="w-80 border-l border-white/5 bg-slate-950/50 backdrop-blur-xl flex flex-col h-full">
      <div className="p-6 border-b border-white/5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
            <FiUsers className="text-primary" /> Participants
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
            {visibleParticipants.length}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {visibleParticipants.map((user) => (
            <motion.div
              key={user.socketId || user.userId}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors group mb-2"
            >
              <div className="relative">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-white font-bold text-sm">
                  {user.name?.charAt(0) || 'U'}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950"></div>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white truncate">{user.name}</p>
                <p className="text-xs text-secondary truncate">Active now</p>
              </div>
              <FiCircle className="w-2 h-2 text-emerald-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </motion.div>
          ))}
        </AnimatePresence>

        {visibleParticipants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary text-sm">No one else is here yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ParticipantSidebar;
