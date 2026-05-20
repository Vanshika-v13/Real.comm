import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { FiUsers, FiCopy, FiCheck, FiPlay, FiShield } from 'react-icons/fi';
import Button from './Button';
import { getAvatarUrl } from '../utils/avatar';

const RoomCard = ({ room, onJoin }) => {
  const [copied, setCopied] = useState(false);

  const copyCode = (e) => {
    e.stopPropagation();
    navigator.clipboard.writeText(room.roomId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const host = room.createdBy || {};

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-panel p-6 rounded-[2rem] border border-white/5 hover:border-white/10 hover:bg-white/10 transition-all duration-300 relative group flex flex-col justify-between min-h-[220px]"
    >
      <div>
        <div className="flex items-start justify-between mb-4">
          <div>
            <h3 className="text-xl font-bold text-white mb-1 group-hover:text-primary transition-colors">
              {room.name || 'Untitled Room'}
            </h3>
            <div className="flex items-center gap-2 mt-1">
              <span className="text-xs font-mono text-secondary bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                {room.roomId}
              </span>
              <button 
                onClick={copyCode}
                className="text-secondary hover:text-white p-1 rounded transition-colors"
                title="Copy Room Code"
              >
                {copied ? <FiCheck className="text-emerald-400" /> : <FiCopy size={12} />}
              </button>
            </div>
          </div>

          {room.joinApprovalEnabled && (
            <span className="flex items-center gap-1.5 px-2.5 py-1 bg-accent/10 border border-accent/20 rounded-full text-accent text-[10px] font-semibold uppercase tracking-wider">
              <FiShield size={10} /> Protected
            </span>
          )}
        </div>

        {/* Creator Info Card */}
        <div className="flex items-center gap-3 p-3 bg-white/5 rounded-2xl border border-white/5 mb-6">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center overflow-hidden shrink-0">
            {host.profileImage ? (
              <img src={getAvatarUrl(host.profileImage)} alt={host.fullName || host.name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[10px] font-bold text-white">
                {(host.fullName || host.name || 'U').charAt(0)}
              </span>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <span className="text-[10px] font-bold text-primary uppercase tracking-widest block">Host</span>
            <p className="text-xs font-semibold text-white truncate">
              {host.fullName || host.name || 'Anonymous Creator'}
            </p>
            {host.username && (
              <p className="text-[9px] text-secondary font-light">
                @{host.username}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between gap-4 border-t border-white/5 pt-4">
        <div className="flex items-center gap-1.5 text-secondary">
          <FiUsers size={14} />
          <span className="text-xs font-medium">
            {room.participants?.length || 1} participant{room.participants?.length !== 1 ? 's' : ''}
          </span>
        </div>
        <Button 
          onClick={() => onJoin(room.roomId)}
          className="h-9 px-4 rounded-xl text-xs font-semibold shrink-0"
        >
          Join Meeting <FiPlay className="ml-1" size={10} />
        </Button>
      </div>
    </motion.div>
  );
};

export default RoomCard;
