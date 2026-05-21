import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { FiUsers, FiX } from 'react-icons/fi';
import { useRoom } from '../context/RoomContext';
import { dedupeParticipants } from '../utils/participants';
import { getAvatarUrl } from '../utils/avatar';

const ParticipantSidebar = ({ raisedHands = [], isHost = false, onLowerHand, mobileOpen = false, onCloseMobile }) => {
  const { participants } = useRoom();
  const visibleParticipants = dedupeParticipants(participants);

  return (
    <>
      {/* Mobile Backdrop */}
      {mobileOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-[55] lg:hidden backdrop-blur-sm"
          onClick={onCloseMobile}
        />
      )}
      <div 
        className={`fixed lg:relative right-0 top-0 h-[100dvh] w-full max-w-[min(20rem,100vw)] sm:w-80 border-l border-white/5 bg-slate-950/90 lg:bg-slate-950/50 backdrop-blur-xl flex flex-col shrink-0 z-[60] lg:z-auto transition-transform duration-300 ease-in-out overflow-hidden ${mobileOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'}`}
      >
        <div className="p-6 border-b border-white/5">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-white uppercase tracking-wider flex items-center gap-2">
              <FiUsers className="text-primary" /> Participants
            </h2>
            <div className="flex items-center gap-3">
              <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-bold">
                {visibleParticipants.length}
              </span>
              <button 
                onClick={onCloseMobile}
                className="lg:hidden text-secondary hover:text-white p-2 hover:bg-white/5 rounded-xl transition-colors"
                title="Close"
              >
                <FiX size={20} />
              </button>
            </div>
          </div>
        </div>

      <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
        <AnimatePresence initial={false}>
          {visibleParticipants.map((user) => {
            const raisedHand = raisedHands.find(
              (h) => h.socketId === user.socketId || h.userId === user.userId
            );
            const hasHandRaised = !!raisedHand;

            return (
              <motion.div
                key={user.socketId || user.userId}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                className="flex items-center gap-3 p-3 rounded-2xl hover:bg-white/5 transition-colors group mb-2"
              >
                <div className="relative">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-white font-bold text-sm overflow-hidden shrink-0">
                    {user.profileImage ? (
                      <img src={getAvatarUrl(user.profileImage)} alt={user.name} className="w-full h-full object-cover" />
                    ) : (
                      user.name?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="absolute bottom-0 right-0 w-3 h-3 bg-emerald-500 rounded-full border-2 border-slate-950"></div>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className="text-sm font-medium text-white truncate">{user.name}</p>
                    {hasHandRaised && (
                      <span className="text-xs animate-bounce" title="Hand raised">✋</span>
                    )}
                  </div>
                  <p className="text-xs text-secondary truncate">Active now</p>
                </div>
                
                {isHost && hasHandRaised && (
                  <button
                    type="button"
                    onClick={() => onLowerHand?.(user.socketId)}
                    className="px-2 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500 text-amber-500 hover:text-slate-950 transition-all text-[10px] font-bold shrink-0"
                  >
                    Lower
                  </button>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>

        {visibleParticipants.length === 0 && (
          <div className="text-center py-12">
            <p className="text-secondary text-sm">No one else is here yet.</p>
          </div>
        )}
      </div>
    </div>
    </>
  );
};

export default ParticipantSidebar;
